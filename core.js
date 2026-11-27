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

  // 5:7 の画像の寸法（花の写真は上の正方形）
  var CARD = { width: 1500, height: 2100, margin: 90 };
  CARD.photo = CARD.width - CARD.margin * 2;

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
  };
})(typeof window !== "undefined" ? window : globalThis);
