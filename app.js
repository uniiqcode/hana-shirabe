// 花しらべ: 写真を小さくして中継に送り、名前の候補を出す。えらんだ名前で 5:7 の画像を作って共有する
(function () {
  "use strict";

  var H = window.HanaCore;
  var MAX_SIDE = 1280; // 送る写真の長い辺（px）
  var LOW_SCORE = 0.2; // これより低いと「撮り直し」をすすめる
  var cfg = window.HANA_CONFIG || {};
  // 住所が無い時と、?demo を付けて開いた時は「お試し表示」
  var DEMO = !cfg.apiUrl || /[?&]demo\b/.test(location.search);

  var COLORS = { bg: "#f5efe3", ink: "#2b2620", sub: "#6f665a", line: "#e2d8c6", accent: "#8c3b4a", bar: "#c9a96b" };
  var SERIF = '"Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", serif';
  var SANS = '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", sans-serif';

  var $ = function (id) { return document.getElementById(id); };
  var picker = $("picker"), result = $("result"), card = $("card"), photo = $("photo");
  var statusEl = $("status"), cands = $("cands"), again = $("again"), make = $("make");
  var chooseTip = $("choose-tip"), cardImg = $("card-img"), shareTip = $("share-tip");

  // 今の写真・候補・えらんだ名前・できた画像
  var state = { file: null, list: [], chosen: 0, cardFile: null, cardUrl: null };

  if (DEMO) $("demo-note").hidden = false;

  $("camera").addEventListener("change", onPick);
  $("library").addEventListener("change", onPick);
  again.addEventListener("click", reset);
  $("again2").addEventListener("click", reset);
  make.addEventListener("click", onMake);
  $("share").addEventListener("click", onShare);
  $("back").addEventListener("click", function () { show(result); });

  function show(section) {
    picker.hidden = section !== picker;
    result.hidden = section !== result;
    card.hidden = section !== card;
    window.scrollTo(0, 0);
  }

  function onPick(e) {
    var file = e.target.files && e.target.files[0];
    e.target.value = ""; // 同じ写真をもう一度選べるように
    if (file) run(file);
  }

  function reset() {
    cands.innerHTML = "";
    if (photo.src) URL.revokeObjectURL(photo.src);
    photo.removeAttribute("src");
    clearCard();
    state.file = null;
    state.list = [];
    show(picker);
  }

  function clearCard() {
    if (state.cardUrl) URL.revokeObjectURL(state.cardUrl);
    state.cardUrl = null;
    state.cardFile = null;
    cardImg.removeAttribute("src");
    shareTip.hidden = true;
  }

  function setStatus(text, isError) {
    statusEl.textContent = text;
    statusEl.classList.toggle("error", !!isError);
  }

  async function run(file) {
    state.file = file;
    show(result);
    again.hidden = true;
    make.hidden = true;
    chooseTip.hidden = true;
    cands.innerHTML = "";
    setStatus("写真を準備しています…");
    try {
      var blob = await shrink(file, MAX_SIDE);
      photo.src = URL.createObjectURL(blob);
      setStatus("名前を調べています…");
      var data = DEMO ? await demoIdentify() : await identify(blob);
      render(data);
    } catch (err) {
      setStatus(messageFor(err), true);
    }
    again.hidden = false;
  }

  // 写真を読み込む（スマホの写真の向きを直す）
  async function decode(file) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch (e) {
      return loadImage(file);
    }
  }

  // 写真を JPEG にして小さくする（位置情報などは消える）
  async function shrink(file, maxSide) {
    var src = await decode(file);
    var w = src.width, h = src.height;
    var k = Math.min(1, maxSide / Math.max(w, h));
    var canvas = document.createElement("canvas");
    canvas.width = Math.round(w * k);
    canvas.height = Math.round(h * k);
    canvas.getContext("2d").drawImage(src, 0, 0, canvas.width, canvas.height);
    if (src.close) src.close();
    return toBlob(canvas, 0.85);
  }

  function toBlob(canvas, quality) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (b) { b ? resolve(b) : reject(new Error("image")); }, "image/jpeg", quality);
    });
  }

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error("image")); };
      img.src = URL.createObjectURL(file);
    });
  }

  async function identify(blob) {
    var form = new FormData();
    form.append("image", blob, "photo.jpg");
    var resp;
    try {
      resp = await fetch(cfg.apiUrl, { method: "POST", body: form });
    } catch (e) {
      throw new Error("network");
    }
    var data = {};
    try { data = await resp.json(); } catch (e) { /* 空のまま */ }
    if (!resp.ok) throw new Error(data.error || "upstream");
    return data;
  }

  function demoIdentify() {
    return new Promise(function (resolve) {
      setTimeout(function () {
        resolve({
          candidates: [
            { scientificName: "Rosa rugosa", nameEn: "Rugosa rose", nameJa: "ハマナス", jaLevel: "species", score: 0.82 },
            { scientificName: "Rosa multiflora", nameEn: "Multiflora rose", nameJa: "ノイバラ", jaLevel: "species", score: 0.09 },
            { scientificName: "Rosa × hybrida", nameEn: null, nameJa: "バラ", jaLevel: "genus", score: 0.04 },
            { scientificName: "Rosa × alba", nameEn: null, nameJa: "バラ", jaLevel: "genus", score: 0.02 },
          ],
        });
      }, 700);
    });
  }

  function messageFor(err) {
    switch (err && err.message) {
      case "quota": return "今日調べられる回数の上限に達しました。日本時間の朝9時にまた使えます。";
      case "network": return "つながりませんでした。電波の良いところで、もう一度お試しください。";
      case "image": return "この写真は読み込めませんでした。別の写真でお試しください。";
      case "too_large": return "写真が大きすぎました。別の写真でお試しください。";
      default: return "うまく調べられませんでした。少し時間をおいて、もう一度お試しください。";
    }
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function render(data) {
    var list = H.dedupeCandidates((data && data.candidates) || []);
    state.list = list;
    state.chosen = 0;
    if (!list.length) {
      setStatus("花の名前が見つかりませんでした。花を大きく写して、もう一度お試しください。", true);
      return;
    }
    var top = list[0].score || 0;
    setStatus(top < LOW_SCORE
      ? "自信のない答えです。花を大きく、明るく写すと当たりやすくなります。"
      : "この花かもしれません");

    list.forEach(function (c, i) {
      var li = el("li", "cand");
      li.setAttribute("role", "radio");
      li.tabIndex = 0;
      li.addEventListener("click", function (e) {
        if (e.target.closest("a")) return; // Wikipedia のリンクはそのまま開く
        choose(i);
      });
      li.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(i); }
      });

      var row = el("div", "cand-top");
      row.appendChild(el("p", "cand-name", H.displayName(c)));
      var pct = H.percent(c.score);
      row.appendChild(el("span", "cand-score", pct + "%"));
      li.appendChild(row);

      var sub = el("p", "cand-sub");
      if (c.nameJa && c.nameEn) sub.appendChild(document.createTextNode(c.nameEn + " ・ "));
      if (c.scientificName) sub.appendChild(el("i", null, c.scientificName));
      li.appendChild(sub);

      var bar = el("div", "bar");
      var fill = el("span");
      fill.style.width = Math.max(2, pct) + "%";
      bar.appendChild(fill);
      li.appendChild(bar);

      if (c.nameJa) {
        var title = c.jaLevel === "genus" ? c.nameJa + "属" : c.nameJa;
        var a = el("a", "cand-link", "Wikipedia で見る");
        a.href = "https://ja.wikipedia.org/wiki/" + encodeURIComponent(title);
        a.target = "_blank";
        a.rel = "noopener";
        li.appendChild(a);
      }
      cands.appendChild(li);
    });
    choose(0);
    chooseTip.hidden = list.length < 2;
    make.hidden = false;
  }

  function choose(i) {
    state.chosen = i;
    Array.prototype.forEach.call(cands.children, function (li, j) {
      li.setAttribute("aria-checked", j === i ? "true" : "false");
    });
  }

  // ---- 5:7 の画像を作る ----

  async function onMake() {
    var c = state.list[state.chosen];
    if (!c || !state.file) return;
    make.disabled = true;
    var label = make.textContent;
    make.textContent = "画像を作っています…";
    try {
      clearCard();
      var blob = await drawCard(state.file, c);
      var name = H.displayName(c).replace(/[\\/:*?"<>|\s]+/g, "_");
      state.cardFile = new File([blob], "hana-shirabe_" + name + ".jpg", { type: "image/jpeg" });
      state.cardUrl = URL.createObjectURL(blob);
      cardImg.src = state.cardUrl;
      show(card);
    } catch (err) {
      setStatus("画像を作れませんでした。もう一度お試しください。", true);
    }
    make.textContent = label;
    make.disabled = false;
  }

  // 文字が幅に収まるまで小さくする
  function fitFont(ctx, text, weight, maxSize, minSize, family, maxWidth) {
    var size = maxSize;
    ctx.font = weight + " " + size + "px " + family;
    while (size > minSize && ctx.measureText(text).width > maxWidth) {
      size -= 4;
      ctx.font = weight + " " + size + "px " + family;
    }
    return size;
  }

  async function loadFonts(text) {
    if (!document.fonts || !document.fonts.load) return;
    try {
      await Promise.race([
        Promise.all([
          document.fonts.load('700 120px "Shippori Mincho"', text),
          document.fonts.load('500 40px "Shippori Mincho"', text),
        ]),
        new Promise(function (r) { setTimeout(r, 3000); }), // 読み込めなくても3秒で先へ
      ]);
    } catch (e) { /* 代わりの明朝体で描く */ }
  }

  async function drawCard(file, c) {
    var C = H.CARD;
    var lines = H.cardLines(c);
    await loadFonts(lines.name + lines.sub + lines.score + lines.source + lines.site);

    var canvas = document.createElement("canvas");
    canvas.width = C.width;
    canvas.height = C.height;
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, C.width, C.height);

    // 花の写真（真ん中の正方形）
    var src = await decode(file);
    var sq = H.centerSquare(src.width, src.height);
    ctx.save();
    roundRect(ctx, C.margin, C.margin, C.photo, C.photo, 28);
    ctx.clip();
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, sq.sx, sq.sy, sq.size, sq.size, C.margin, C.margin, C.photo, C.photo);
    ctx.restore();
    if (src.close) src.close();

    var x = C.margin, w = C.photo, top = C.margin + C.photo;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";

    // 名前
    ctx.fillStyle = COLORS.ink;
    fitFont(ctx, lines.name, "700", 128, 64, SERIF, w);
    ctx.fillText(lines.name, x, top + 190);

    // 英名・学名
    if (lines.sub) {
      ctx.fillStyle = COLORS.sub;
      fitFont(ctx, lines.sub, "500", 44, 28, SERIF, w);
      ctx.fillText(lines.sub, x, top + 275);
    }

    // 確からしさ（文字と棒）
    ctx.fillStyle = COLORS.accent;
    ctx.font = "600 48px " + SANS;
    ctx.fillText(lines.score, x, top + 375);
    ctx.fillStyle = COLORS.line;
    roundRect(ctx, x, top + 405, w, 12, 6);
    ctx.fill();
    ctx.fillStyle = COLORS.bar;
    roundRect(ctx, x, top + 405, Math.max(12, w * Math.min(1, c.score || 0)), 12, 6);
    ctx.fill();

    // 出典
    ctx.fillStyle = COLORS.sub;
    fitFont(ctx, lines.source, "400", 32, 22, SANS, w);
    ctx.fillText(lines.source, x, top + 510);
    ctx.font = "400 32px " + SANS;
    ctx.fillText(lines.site, x, top + 570);

    return toBlob(canvas, 0.92);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---- 保存・共有 ----

  async function onShare() {
    var file = state.cardFile;
    if (!file) return;
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "花しらべ" });
        return;
      } catch (err) {
        if (err && err.name === "AbortError") return; // 閉じただけ
      }
    }
    // 共有の画面が使えない時は、ファイルとして保存する
    var a = document.createElement("a");
    a.href = state.cardUrl;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    shareTip.hidden = false;
  }
})();
