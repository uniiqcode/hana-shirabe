// 花しらべ の中継（Cloudflare Workers）
//
// ブラウザから写真（JPEG）を受け取り、Pl@ntNet に問い合わせて、
// 候補ごとに Wikidata から和名を引いて返す。
// Pl@ntNet の API キーは、Cloudflare の秘密の値 PLANTNET_API_KEY にだけ置く。
//
// 元: uniiqcode/niisan-tv の backend/uniiqcode/identify_flowers.py（設計は docs/backend/flower-db.md §12.4）
//
// 設定（Cloudflare の画面の「設定」→「変数とシークレット」）
//   PLANTNET_API_KEY  … 秘密の値（Secret）。必須
//   ALLOWED_ORIGINS   … 呼び出してよいページの元（カンマ区切り）。省略時は https://uniiqcode.com

const PLANTNET_URL = "https://my-api.plantnet.org/v2/identify/all";
const WIKIDATA_URL = "https://www.wikidata.org/w/api.php";
const USER_AGENT = "hana-shirabe/0.1 (https://uniiqcode.com/hana-shirabe/)";
const DEFAULT_ORIGINS = "https://uniiqcode.com";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_CANDIDATES = 3;

// 同じ学名を何度も Wikidata に聞かないための覚え書き（中継が動いている間だけ）
const jaNameCache = new Map();

export function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || DEFAULT_ORIGINS)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function corsHeaders(origin, env) {
  const ok = origin && allowedOrigins(env).includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin : "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

// 日本語版 Wikipedia の属の記事は題名の末尾が「属」（例: ヒャクニチソウ属）。表示用に削る
export function stripGenusSuffix(title) {
  if (title && title.endsWith("属") && title.length > 1) return title.slice(0, -1);
  return title;
}

// 題名の曖昧さ回避の括弧（例: 「アサガオ (植物)」）を削る
export function stripDisambiguation(title) {
  return title ? title.replace(/\s*[（(][^）)]*[）)]\s*$/, "") : title;
}

async function wikidataFindEntity(term, fetchFn) {
  const params = new URLSearchParams({
    action: "wbsearchentities",
    search: term,
    language: "en",
    type: "item",
    format: "json",
    limit: "1",
  });
  const resp = await fetchFn(`${WIKIDATA_URL}?${params}`, { headers: { "User-Agent": USER_AGENT } });
  if (!resp.ok) throw new Error(`wikidata search ${resp.status}`);
  const hits = (await resp.json()).search || [];
  return hits.length ? hits[0].id : null;
}

// 項目から日本語の名前を得る。日本語版 Wikipedia の題名を優先し、無ければ日本語のラベル
async function wikidataJaName(entityId, fetchFn) {
  const params = new URLSearchParams({
    action: "wbgetentities",
    ids: entityId,
    props: "sitelinks|labels",
    languages: "ja",
    sitefilter: "jawiki",
    format: "json",
  });
  const resp = await fetchFn(`${WIKIDATA_URL}?${params}`, { headers: { "User-Agent": USER_AGENT } });
  if (!resp.ok) throw new Error(`wikidata entity ${resp.status}`);
  const entity = ((await resp.json()).entities || {})[entityId] || {};
  const title = entity.sitelinks && entity.sitelinks.jawiki && entity.sitelinks.jawiki.title;
  if (title) return stripDisambiguation(title);
  const label = entity.labels && entity.labels.ja && entity.labels.ja.value;
  return label || null;
}

// 学名から和名を引く。種で見つからなければ属の名前で探し直す。
// 返り値: { name, level: "species" | "genus" } または null
export async function lookupJapaneseName(scientificName, fetchFn = fetch) {
  if (!scientificName) return null;
  if (jaNameCache.has(scientificName)) return jaNameCache.get(scientificName);

  let result = null;
  const id = await wikidataFindEntity(scientificName, fetchFn);
  if (id) {
    const name = await wikidataJaName(id, fetchFn);
    if (name) result = { name: stripGenusSuffix(name), level: name.endsWith("属") ? "genus" : "species" };
  }
  if (!result) {
    const genus = scientificName.split(/\s+/)[0];
    if (genus && genus !== scientificName) {
      const gid = await wikidataFindEntity(genus, fetchFn);
      if (gid) {
        const gname = await wikidataJaName(gid, fetchFn);
        if (gname) result = { name: stripGenusSuffix(gname), level: "genus" };
      }
    }
  }
  jaNameCache.set(scientificName, result);
  return result;
}

// Pl@ntNet の答えから候補を取り出す
export function parsePlantnet(payload, max = MAX_CANDIDATES) {
  const results = (payload && payload.results) || [];
  return results.slice(0, max).map((r) => {
    const sp = r.species || {};
    const common = sp.commonNames || [];
    return {
      scientificName: sp.scientificNameWithoutAuthor || null,
      nameEn: common[0] || null,
      family: (sp.family && sp.family.scientificNameWithoutAuthor) || null,
      score: typeof r.score === "number" ? r.score : null,
    };
  });
}

export async function handleIdentify(request, env, fetchFn = fetch) {
  const origin = request.headers.get("Origin");
  const cors = corsHeaders(origin, env);

  if (!origin || !allowedOrigins(env).includes(origin)) {
    return json({ error: "forbidden" }, 403, cors);
  }
  if (!env.PLANTNET_API_KEY) {
    return json({ error: "not_configured" }, 500, cors);
  }

  let image;
  try {
    const form = await request.formData();
    image = form.get("image");
  } catch {
    return json({ error: "bad_request" }, 400, cors);
  }
  if (!image || typeof image === "string") return json({ error: "no_image" }, 400, cors);
  if (image.size > MAX_IMAGE_BYTES) return json({ error: "too_large" }, 413, cors);

  const out = new FormData();
  out.append("images", image, "photo.jpg");
  out.append("organs", "flower");
  const url = `${PLANTNET_URL}?${new URLSearchParams({
    "api-key": env.PLANTNET_API_KEY,
    "nb-results": String(MAX_CANDIDATES),
    lang: "en",
    "include-related-images": "false",
  })}`;

  const resp = await fetchFn(url, { method: "POST", body: out });
  if (resp.status === 429) return json({ error: "quota" }, 429, cors);
  if (resp.status === 404) return json({ candidates: [] }, 200, cors); // Pl@ntNet: 種が見つからない
  if (!resp.ok) return json({ error: "upstream", status: resp.status }, 502, cors);

  const payload = await resp.json();
  const candidates = parsePlantnet(payload);

  await Promise.all(
    candidates.map(async (c) => {
      try {
        const ja = await lookupJapaneseName(c.scientificName, fetchFn);
        c.nameJa = ja ? ja.name : null;
        c.jaLevel = ja ? ja.level : null;
      } catch {
        c.nameJa = null;
        c.jaLevel = null;
      }
    })
  );

  return json(
    { candidates, remaining: payload.remainingIdentificationRequests ?? null },
    200,
    cors
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
    }
    if (url.pathname === "/identify" && request.method === "POST") {
      return handleIdentify(request, env);
    }
    if (url.pathname === "/" && request.method === "GET") {
      return new Response("hana-shirabe relay: ok", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
    return json({ error: "not_found" }, 404, corsHeaders(origin, env));
  },
};
