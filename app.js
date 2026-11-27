// 花しらべ: 写真を小さくして中継に送り、名前の候補を出す。えらんだ名前で 5:7 の画像を作って共有する
(function () {
  "use strict";

  var H = window.HanaCore;
  var LOW_SCORE = 0.2; // これより低いと「撮り直し」をすすめる
  var cfg = window.HANA_CONFIG || {};
  // 住所が無い時と、?demo を付けて開いた時は「お試し表示」
  var DEMO = !cfg.apiUrl || /[?&]demo\b/.test(location.search);

  var COLORS = { bg: "#f5efe3", ink: "#2b2620", sub: "#6f665a", line: "#e2d8c6", accent: "#8c3b4a", bar: "#c9a96b" };
  // Android は Noto 系、iPhone はヒラギノ系が代わりの字体になる
  var SERIF = '"Shippori Mincho", "Hiragino Mincho ProN", "Noto Serif JP", "Noto Serif CJK JP", "Yu Mincho", serif';
  var SANS = '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", "Noto Sans CJK JP", Roboto, sans-serif';
  var CROP_MAX = 1500; // 切り出す写真の一辺（px）。5:7 の画像の写真と同じ
  var MAX_ZOOM = 6;

  var $ = function (id) { return document.getElementById(id); };
  var picker = $("picker"), crop = $("crop"), result = $("result"), card = $("card"), photo = $("photo");
  var frame = $("crop-frame"), cropCanvas = $("crop-canvas"), zoomRange = $("zoom");
  var statusEl = $("status"), cands = $("cands"), again = $("again"), make = $("make");
  var chooseTip = $("choose-tip"), cardImg = $("card-img"), shareTip = $("share-tip");

  // 今の写真・候補・えらんだ名前・できた画像
  // img: 読み込んだ写真、view: 枠の中の倍率と位置、square: 切り出した正方形の写真
  var state = { img: null, view: null, size: 0, square: null, list: [], chosen: 0, cardFile: null, cardUrl: null };

  if (DEMO) $("demo-note").hidden = false;

  $("camera").addEventListener("change", onPick);
  $("library").addEventListener("change", onPick);
  again.addEventListener("click", reset);
  $("again2").addEventListener("click", reset);
  make.addEventListener("click", onMake);
  $("share").addEventListener("click", onShare);
  $("back").addEventListener("click", function () { show(result); });
  $("crop-ok").addEventListener("click", onCropOk);
  $("crop-cancel").addEventListener("click", reset);
  setupGuide();

  // 右上の i: ホーム画面に追加する方法と、住所のコピー
  function setupGuide() {
    var guide = $("guide"), urlInput = $("app-url"), msg = $("copy-msg");
    function open() {
      msg.textContent = "";
      if (guide.showModal) guide.showModal(); else guide.setAttribute("open", "");
    }
    function close() {
      if (guide.close) guide.close(); else guide.removeAttribute("open");
    }
    $("info-btn").addEventListener("click", open);
    $("guide-close").addEventListener("click", close);
    $("guide-ok").addEventListener("click", close);
    // 外側（暗いところ）を押しても閉じる
    guide.addEventListener("click", function (e) { if (e.target === guide) close(); });
    $("copy-url").addEventListener("click", function () {
      copyText(urlInput.value).then(function (ok) {
        msg.textContent = ok ? "コピーしました。ブラウザの住所の欄に貼り付けてください。" : "コピーできませんでした。住所を長押ししてコピーしてください。";
        if (!ok) { urlInput.focus(); urlInput.select(); }
      });
    });
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }

  // 古い端末・アプリ内ブラウザ向け
  function legacyCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed"; ta.style.top = "0"; ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select(); ta.setSelectionRange(0, text.length);
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  function show(section) {
    picker.hidden = section !== picker;
    crop.hidden = section !== crop;
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
    if (state.img && state.img.close) state.img.close();
    state.img = null;
    state.square = null;
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

  // 写真をえらんだら、まず枠におさめる画面へ
  async function run(file) {
    try {
      var img = await decode(file);
      if (state.img && state.img.close) state.img.close();
      state.img = img;
      show(crop);
      setupView();
    } catch (err) {
      show(result);
      cands.innerHTML = "";
      make.hidden = true;
      chooseTip.hidden = true;
      photo.removeAttribute("src");
      setStatus(messageFor(err), true);
      again.hidden = false;
    }
  }

  // 「この範囲で調べる」: 枠の中を切り出して、名前を調べる
  async function onCropOk() {
    if (!state.img) return;
    state.square = cropSquare();
    show(result);
    again.hidden = true;
    make.hidden = true;
    chooseTip.hidden = true;
    cands.innerHTML = "";
    clearCard();
    try {
      var blob = await toBlob(state.square, 0.88);
      if (photo.src) URL.revokeObjectURL(photo.src);
      photo.src = URL.createObjectURL(blob);
      setStatus("名前を調べています…");
      var data = DEMO ? await demoIdentify() : await identify(blob);
      render(data);
    } catch (err) {
      setStatus(messageFor(err), true);
    }
    again.hidden = false;
  }

  // ---- 枠の中で、写真を拡大・縮小・移動する ----

  var pointers = new Map(); // 画面に触れている指（マウス）
  var last = null; // 前回の指の位置（1本なら位置、2本なら真ん中と間の長さ）

  function setupView() {
    var rect = frame.getBoundingClientRect();
    state.size = rect.width;
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    cropCanvas.width = Math.round(rect.width * dpr);
    cropCanvas.height = Math.round(rect.width * dpr);
    state.view = H.initialView(state.img.width, state.img.height, state.size);
    drawView();
  }

  function setView(v) {
    state.view = H.clampView(v, state.img.width, state.img.height, state.size, MAX_ZOOM);
    drawView();
  }

  function drawView() {
    var ctx = cropCanvas.getContext("2d");
    var k = cropCanvas.width / state.size;
    var v = state.view, img = state.img;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#2b2620";
    ctx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
    ctx.imageSmoothingQuality = "high";
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.drawImage(img, v.x, v.y, img.width * v.scale, img.height * v.scale);
    // つまみの位置を今の倍率に合わせる
    var min = H.coverScale(img.width, img.height, state.size);
    zoomRange.value = String(Math.round(1000 * Math.log(v.scale / min) / Math.log(MAX_ZOOM)));
  }

  function zoomBy(factor, px, py) {
    var v = state.view;
    if (px == null) { px = state.size / 2; py = state.size / 2; }
    state.view = H.zoomAt(v, factor, px, py, state.img.width, state.img.height, state.size, MAX_ZOOM);
    drawView();
  }

  function localPoint(e) {
    var r = frame.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function gesture() {
    var pts = Array.from(pointers.values());
    if (pts.length >= 2) {
      var a = pts[0], b = pts[1];
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) };
    }
    return pts.length ? { x: pts[0].x, y: pts[0].y, d: 0 } : null;
  }

  frame.addEventListener("pointerdown", function (e) {
    if (!state.img) return;
    frame.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, localPoint(e));
    last = gesture();
    e.preventDefault();
  });
  frame.addEventListener("pointermove", function (e) {
    if (!pointers.has(e.pointerId) || !state.img) return;
    pointers.set(e.pointerId, localPoint(e));
    var g = gesture();
    if (last && g) {
      var v = state.view;
      var moved = { scale: v.scale, x: v.x + (g.x - last.x), y: v.y + (g.y - last.y) };
      if (g.d && last.d) {
        // 2本の指: 真ん中を中心に拡大・縮小しながら動かす
        state.view = H.zoomAt(moved, g.d / last.d, g.x, g.y, state.img.width, state.img.height, state.size, MAX_ZOOM);
        drawView();
      } else {
        setView(moved);
      }
    }
    last = g;
    e.preventDefault();
  });
  function endPointer(e) {
    pointers.delete(e.pointerId);
    last = gesture();
  }
  frame.addEventListener("pointerup", endPointer);
  frame.addEventListener("pointercancel", endPointer);
  // パソコンのマウスのホイール
  frame.addEventListener("wheel", function (e) {
    if (!state.img) return;
    e.preventDefault();
    var p = localPoint(e);
    zoomBy(Math.exp(-e.deltaY * 0.002), p.x, p.y);
  }, { passive: false });
  // iPhone の Safari で、ページ全体が拡大されるのを防ぐ
  frame.addEventListener("gesturestart", function (e) { e.preventDefault(); });

  zoomRange.addEventListener("input", function () {
    if (!state.img) return;
    var min = H.coverScale(state.img.width, state.img.height, state.size);
    var target = min * Math.pow(MAX_ZOOM, Number(zoomRange.value) / 1000);
    zoomBy(target / state.view.scale);
  });
  $("zoom-in").addEventListener("click", function () { if (state.img) zoomBy(1.25); });
  $("zoom-out").addEventListener("click", function () { if (state.img) zoomBy(0.8); });

  window.addEventListener("resize", function () {
    if (crop.hidden || !state.img) return;
    // 画面の向きが変わった時は、今見えている範囲を保って描き直す
    var r = H.cropRect(state.view, state.size);
    var rect = frame.getBoundingClientRect();
    if (!rect.width || rect.width === state.size) return;
    state.size = rect.width;
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    cropCanvas.width = cropCanvas.height = Math.round(rect.width * dpr);
    var scale = state.size / r.size;
    setView({ scale: scale, x: -r.sx * scale, y: -r.sy * scale });
  });

  // 枠の中に見えている範囲を、元の写真の解像度で切り出す（一辺は最大 CROP_MAX）
  function cropSquare() {
    var r = H.cropRect(state.view, state.size);
    var out = Math.max(1, Math.round(Math.min(CROP_MAX, r.size)));
    var c = document.createElement("canvas");
    c.width = c.height = out;
    var ctx = c.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(state.img, r.sx, r.sy, r.size, r.size, 0, 0, out, out);
    return c;
  }

  // 写真を読み込む（スマホの写真の向きを直す）
  async function decode(file) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch (e) {
      return loadImage(file);
    }
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
    if (!c || !state.square) return;
    make.disabled = true;
    var label = make.textContent;
    make.textContent = "画像を作っています…";
    try {
      clearCard();
      var blob = await drawCard(state.square, c);
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

  // 5:7 の画像: 上に花の写真（左右と上は余白なし）、下の帯に名前・確からしさ・出典
  async function drawCard(square, c) {
    var C = H.CARD;
    var lines = H.cardLines(c);
    await loadFonts(lines.name + lines.sub + lines.score + lines.source + lines.site);

    var canvas = document.createElement("canvas");
    canvas.width = C.width;
    canvas.height = C.height;
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, C.width, C.height);

    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(square, 0, 0, square.width, square.height, 0, 0, C.photo, C.photo);

    var x = C.margin, w = C.width - C.margin * 2, top = C.photo;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";

    // 名前
    ctx.fillStyle = COLORS.ink;
    fitFont(ctx, lines.name, "700", 128, 64, SERIF, w);
    ctx.fillText(lines.name, x, top + 165);

    // 英名・学名
    if (lines.sub) {
      ctx.fillStyle = COLORS.sub;
      fitFont(ctx, lines.sub, "500", 44, 28, SERIF, w);
      ctx.fillText(lines.sub, x, top + 245);
    }

    // 確からしさ（文字と棒）
    ctx.fillStyle = COLORS.accent;
    ctx.font = "600 48px " + SANS;
    ctx.fillText(lines.score, x, top + 340);
    ctx.fillStyle = COLORS.line;
    roundRect(ctx, x, top + 370, w, 12, 6);
    ctx.fill();
    ctx.fillStyle = COLORS.bar;
    roundRect(ctx, x, top + 370, Math.max(12, w * Math.min(1, c.score || 0)), 12, 6);
    ctx.fill();

    // 出典
    ctx.fillStyle = COLORS.sub;
    fitFont(ctx, lines.source, "400", 32, 22, SANS, w);
    ctx.fillText(lines.source, x, top + 465);
    ctx.font = "400 32px " + SANS;
    ctx.fillText(lines.site, x, top + 520);

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
