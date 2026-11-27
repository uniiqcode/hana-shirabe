// ネットにつながないテスト: node --test tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import worker, {
  stripGenusSuffix,
  stripDisambiguation,
  parsePlantnet,
  lookupJapaneseName,
  handleIdentify,
  corsHeaders,
} from "../worker/worker.js";

const ORIGIN = "https://uniiqcode.com";
const ENV = { PLANTNET_API_KEY: "test-key" };

function jsonResp(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// Wikidata の偽物: 検索語 → 項目ID、項目ID → { jawiki, label }
function fakeWikidata(search, entities, calls = []) {
  return async (url) => {
    const u = new URL(url);
    calls.push(u.searchParams.get("action") + ":" + (u.searchParams.get("search") || u.searchParams.get("ids")));
    if (u.searchParams.get("action") === "wbsearchentities") {
      const id = search[u.searchParams.get("search")];
      return jsonResp({ search: id ? [{ id }] : [] });
    }
    const id = u.searchParams.get("ids");
    const e = entities[id] || {};
    return jsonResp({
      entities: {
        [id]: {
          sitelinks: e.jawiki ? { jawiki: { title: e.jawiki } } : {},
          labels: e.label ? { ja: { value: e.label } } : {},
        },
      },
    });
  };
}

function photoRequest(origin = ORIGIN) {
  const form = new FormData();
  form.append("image", new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" }), "p.jpg");
  const headers = origin ? { Origin: origin } : {};
  return new Request("https://relay.example/identify", { method: "POST", body: form, headers });
}

test("属を削る・括弧を削る", () => {
  assert.equal(stripGenusSuffix("ヒャクニチソウ属"), "ヒャクニチソウ");
  assert.equal(stripGenusSuffix("属"), "属");
  assert.equal(stripGenusSuffix("バラ"), "バラ");
  assert.equal(stripDisambiguation("アサガオ (植物)"), "アサガオ");
  assert.equal(stripDisambiguation("キキョウ（植物）"), "キキョウ");
});

test("Pl@ntNet の答えから上位3つを取り出す", () => {
  const payload = {
    results: [1, 2, 3, 4].map((i) => ({
      score: 0.9 / i,
      species: {
        scientificNameWithoutAuthor: `Sp ${i}`,
        commonNames: i === 2 ? [] : [`Name ${i}`],
        family: { scientificNameWithoutAuthor: "Rosaceae" },
      },
    })),
  };
  const c = parsePlantnet(payload);
  assert.equal(c.length, 3);
  assert.deepEqual(c[0], { scientificName: "Sp 1", nameEn: "Name 1", family: "Rosaceae", score: 0.9 });
  assert.equal(c[1].nameEn, null);
  assert.deepEqual(parsePlantnet({}), []);
});

test("和名: 種の記事があればその題名", async () => {
  const f = fakeWikidata({ "Zinnia elegans": "Q1" }, { Q1: { jawiki: "ヒャクニチソウ" } });
  assert.deepEqual(await lookupJapaneseName("Zinnia elegans", f), { name: "ヒャクニチソウ", level: "species" });
});

test("和名: 記事が無ければ日本語のラベル", async () => {
  const f = fakeWikidata({ "Viola test": "Q2" }, { Q2: { label: "テストスミレ" } });
  assert.deepEqual(await lookupJapaneseName("Viola test", f), { name: "テストスミレ", level: "species" });
});

test("和名: 種で見つからなければ属で探し直し、末尾の属を削る", async () => {
  const calls = [];
  const f = fakeWikidata({ Lantana: "Q3" }, { Q3: { jawiki: "シチヘンゲ属" } }, calls);
  assert.deepEqual(await lookupJapaneseName("Lantana × strigocamara", f), { name: "シチヘンゲ", level: "genus" });
  assert.deepEqual(calls, ["wbsearchentities:Lantana × strigocamara", "wbsearchentities:Lantana", "wbgetentities:Q3"]);
});

test("和名: 何も見つからなければ null", async () => {
  const f = fakeWikidata({}, {});
  assert.equal(await lookupJapaneseName("Nothing here", f), null);
});

test("許可していないページからは断る", async () => {
  const r = await handleIdentify(photoRequest("https://evil.example"), ENV, async () => {
    throw new Error("呼ばれてはいけない");
  });
  assert.equal(r.status, 403);
  const r2 = await handleIdentify(photoRequest(null), ENV, async () => {
    throw new Error("呼ばれてはいけない");
  });
  assert.equal(r2.status, 403);
  assert.equal(corsHeaders("https://evil.example", ENV)["Access-Control-Allow-Origin"], "null");
});

test("キーが無ければ設定の不足を返す", async () => {
  const r = await handleIdentify(photoRequest(), {}, async () => {
    throw new Error("呼ばれてはいけない");
  });
  assert.equal(r.status, 500);
  assert.equal((await r.json()).error, "not_configured");
});

test("名前を調べる: Pl@ntNet → Wikidata の流れ", async () => {
  let plantnetUrl, plantnetBody;
  const wd = fakeWikidata({ "Rosa rugosa": "Q10" }, { Q10: { jawiki: "ハマナス" } });
  const f = async (url, init) => {
    if (String(url).startsWith("https://my-api.plantnet.org/")) {
      plantnetUrl = new URL(url);
      plantnetBody = init.body;
      return jsonResp({
        results: [{ score: 0.81, species: { scientificNameWithoutAuthor: "Rosa rugosa", commonNames: ["Rugosa rose"] } }],
        remainingIdentificationRequests: 499,
      });
    }
    return wd(url);
  };
  const r = await handleIdentify(photoRequest(), ENV, f);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  const body = await r.json();
  assert.equal(body.remaining, 499);
  assert.deepEqual(body.candidates[0], {
    scientificName: "Rosa rugosa",
    nameEn: "Rugosa rose",
    family: null,
    score: 0.81,
    nameJa: "ハマナス",
    jaLevel: "species",
  });
  assert.equal(plantnetUrl.searchParams.get("api-key"), "test-key");
  assert.equal(plantnetBody.get("organs"), "flower");
  assert.ok(plantnetBody.get("images"));
});

test("Pl@ntNet の上限・見つからない時", async () => {
  const r = await handleIdentify(photoRequest(), ENV, async () => new Response("", { status: 429 }));
  assert.equal(r.status, 429);
  assert.equal((await r.json()).error, "quota");
  const r2 = await handleIdentify(photoRequest(), ENV, async () => new Response("", { status: 404 }));
  assert.deepEqual(await r2.json(), { candidates: [] });
});

test("Wikidata が失敗しても候補は返す", async () => {
  const f = async (url) => {
    if (String(url).startsWith("https://my-api.plantnet.org/")) {
      return jsonResp({ results: [{ score: 0.5, species: { scientificNameWithoutAuthor: "Bellis failtest" } }] });
    }
    return new Response("", { status: 503 });
  };
  const body = await (await handleIdentify(photoRequest(), ENV, f)).json();
  assert.equal(body.candidates[0].scientificName, "Bellis failtest");
  assert.equal(body.candidates[0].nameJa, null);
});

test("入口: OPTIONS とそれ以外の道", async () => {
  const pre = await worker.fetch(new Request("https://relay.example/identify", { method: "OPTIONS", headers: { Origin: ORIGIN } }), ENV);
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  const nf = await worker.fetch(new Request("https://relay.example/other"), ENV);
  assert.equal(nf.status, 404);
});
