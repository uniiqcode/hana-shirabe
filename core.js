// 花しらべ: 画面に依らない処理（ブラウザとテストの両方で使う）
(function (root) {
  "use strict";

  // 画面に出す名前。和名があれば和名（属しかわからなければ「〜の仲間」）、無ければ英名、学名
  function displayName(c) {
    if (c.nameJa) return c.jaLevel === "genus" ? c.nameJa + "の仲間" : c.nameJa;
    return c.nameEn || c.scientificName || "（名前不明）";
  }

  // 名前が完全に同じ候補は、確率の高い方だけ残す（並びは確率の高い順）
  function dedupeCandidates(list) {
    var sorted = (list || []).slice().sort(function (a, b) { return (b.score || 0) - (a.score || 0); });
    var seen = {};
    return sorted.filter(function (c) {
      var key = displayName(c);
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function percent(score) {
    return Math.round((score || 0) * 100);
  }

  // 画像の下に入れる文字
  function cardLines(c) {
    var sub = [];
    if (c.nameJa && c.nameEn) sub.push(c.nameEn);
    if (c.scientificName) sub.push(c.scientificName);
    var source = c.nameJa
      ? "出典: Pl@ntNet（名前の判定）・Wikipedia（和名）"
      : "出典: Pl@ntNet（名前の判定）";
    return {
      name: displayName(c),
      sub: sub.join(" ・ "),
      score: "確からしさ " + percent(c.score) + "%",
      source: source,
      site: "花しらべ  uniiqcode.com/hana-shirabe",
    };
  }

  // 5:7 の画像の寸法。花の写真は上の正方形で、左右と上に余白を作らない。文字は下の帯に入れる
  var CARD = { width: 1500, height: 2100, margin: 90 };
  CARD.photo = CARD.width;

  // ---- 写真の拡大・縮小・移動（正方形の枠 size に、写真 w×h をおさめる） ----

  // 枠をすき間なく埋める、いちばん小さい倍率
  function coverScale(w, h, size) {
    return Math.max(size / w, size / h);
  }

  // 倍率と位置を、枠にすき間ができない範囲に収める（x, y は写真の左上の位置）
  function clampView(v, w, h, size, maxZoom) {
    var min = coverScale(w, h, size);
    var scale = Math.min(Math.max(v.scale, min), min * (maxZoom || 6));
    var x = Math.min(0, Math.max(size - w * scale, v.x));
    var y = Math.min(0, Math.max(size - h * scale, v.y));
    return { scale: scale, x: x, y: y };
  }

  // はじめの表示: 枠をちょうど埋めて、真ん中に置く
  function initialView(w, h, size) {
    var scale = coverScale(w, h, size);
    return { scale: scale, x: (size - w * scale) / 2, y: (size - h * scale) / 2 };
  }

  // 点 (px, py) を中心に倍率を factor 倍にする（指でつまむ・ホイール）
  function zoomAt(v, factor, px, py, w, h, size, maxZoom) {
    var ix = (px - v.x) / v.scale, iy = (py - v.y) / v.scale; // 写真の上の点
    var scale = v.scale * factor;
    return clampView({ scale: scale, x: px - ix * scale, y: py - iy * scale }, w, h, size, maxZoom);
  }

  // 枠の中に見えている範囲を、元の写真の座標で返す
  function cropRect(v, size) {
    return { sx: -v.x / v.scale, sy: -v.y / v.scale, size: size / v.scale };
  }

  // 写真の真ん中から正方形を切り出す範囲
  function centerSquare(w, h) {
    var s = Math.min(w, h);
    return { sx: Math.round((w - s) / 2), sy: Math.round((h - s) / 2), size: s };
  }

  root.HanaCore = {
    displayName: displayName,
    dedupeCandidates: dedupeCandidates,
    percent: percent,
    cardLines: cardLines,
    CARD: CARD,
    centerSquare: centerSquare,
    coverScale: coverScale,
    clampView: clampView,
    initialView: initialView,
    zoomAt: zoomAt,
    cropRect: cropRect,
  };
})(typeof window !== "undefined" ? window : globalThis);
