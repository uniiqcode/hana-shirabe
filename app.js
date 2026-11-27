// 花しらべ: 写真を小さくして中継に送り、名前の候補を出す
(function () {
  "use strict";

  var MAX_SIDE = 1280; // 送る写真の長い辺（px）
  var LOW_SCORE = 0.2; // これより低いと「撮り直し」をすすめる
  var cfg = window.HANA_CONFIG || {};
  var DEMO = !cfg.apiUrl;

  var $ = function (id) { return document.getElementById(id); };
  var picker = $("picker"), result = $("result"), photo = $("photo");
  var statusEl = $("status"), cands = $("cands"), again = $("again");

  if (DEMO) $("demo-note").hidden = false;

  $("camera").addEventListener("change", onPick);
  $("library").addEventListener("change", onPick);
  again.addEventListener("click", reset);

  function onPick(e) {
    var file = e.target.files && e.target.files[0];
    e.target.value = ""; // 同じ写真をもう一度選べるように
    if (file) run(file);
  }

  function reset() {
    result.hidden = true;
    picker.hidden = false;
    cands.innerHTML = "";
    if (photo.src) URL.revokeObjectURL(photo.src);
    photo.removeAttribute("src");
    window.scrollTo(0, 0);
  }

  function setStatus(text, isError) {
    statusEl.textContent = text;
    statusEl.classList.toggle("error", !!isError);
  }

  async function run(file) {
    picker.hidden = true;
    result.hidden = false;
    again.hidden = true;
    cands.innerHTML = "";
    setStatus("写真を準備しています…");
    try {
      var blob = await shrink(file);
      photo.src = URL.createObjectURL(blob);
      setStatus("名前を調べています…");
      var data = DEMO ? await demoIdentify() : await identify(blob);
      render(data);
    } catch (err) {
      setStatus(messageFor(err), true);
    }
    again.hidden = false;
  }

  // 写真を JPEG にして小さくする（向きを直し、位置情報などは消える）
  async function shrink(file) {
    var src;
    try {
      src = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch (e) {
      src = await loadImage(file);
    }
    var w = src.width, h = src.height;
    var k = Math.min(1, MAX_SIDE / Math.max(w, h));
    var canvas = document.createElement("canvas");
    canvas.width = Math.round(w * k);
    canvas.height = Math.round(h * k);
    canvas.getContext("2d").drawImage(src, 0, 0, canvas.width, canvas.height);
    if (src.close) src.close();
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (b) { b ? resolve(b) : reject(new Error("image")); }, "image/jpeg", 0.85);
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

  function displayName(c) {
    if (c.nameJa) return c.jaLevel === "genus" ? c.nameJa + "の仲間" : c.nameJa;
    return c.nameEn || c.scientificName || "（名前不明）";
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function render(data) {
    var list = (data && data.candidates) || [];
    if (!list.length) {
      setStatus("花の名前が見つかりませんでした。花を大きく写して、もう一度お試しください。", true);
      return;
    }
    var top = list[0].score || 0;
    setStatus(top < LOW_SCORE
      ? "自信のない答えです。花を大きく、明るく写すと当たりやすくなります。"
      : "この花かもしれません");

    list.forEach(function (c) {
      var li = el("li", "cand");
      var row = el("div", "cand-top");
      row.appendChild(el("p", "cand-name", displayName(c)));
      var pct = Math.round((c.score || 0) * 100);
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
  }
})();
