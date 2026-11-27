// 画面に依らない処理のテスト: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import "../core.js";

const H = globalThis.HanaCore;

test("名前の出し方", () => {
  assert.equal(H.displayName({ nameJa: "ハマナス", jaLevel: "species" }), "ハマナス");
  assert.equal(H.displayName({ nameJa: "バラ", jaLevel: "genus" }), "バラの仲間");
  assert.equal(H.displayName({ nameEn: "Rose", scientificName: "Rosa sp." }), "Rose");
  assert.equal(H.displayName({ scientificName: "Rosa sp." }), "Rosa sp.");
});

test("同じ名前は確率の高い方だけ残す", () => {
  const list = [
    { scientificName: "Rosa a", nameJa: "バラ", jaLevel: "genus", score: 0.1 },
    { scientificName: "Rosa b", nameJa: "ハマナス", jaLevel: "species", score: 0.6 },
    { scientificName: "Rosa c", nameJa: "バラ", jaLevel: "genus", score: 0.2 },
  ];
  const out = H.dedupeCandidates(list);
  assert.deepEqual(out.map((c) => c.scientificName), ["Rosa b", "Rosa c"]);
});

test("名前が違えば残す（和名と、属の「仲間」は別の名前）", () => {
  const list = [
    { nameJa: "バラ", jaLevel: "species", score: 0.5 },
    { nameJa: "バラ", jaLevel: "genus", score: 0.3 },
    { nameEn: "Rose", score: 0.1 },
  ];
  assert.equal(H.dedupeCandidates(list).length, 3);
  assert.deepEqual(H.dedupeCandidates([]), []);
  assert.deepEqual(H.dedupeCandidates(undefined), []);
});

test("画像の文字", () => {
  const l = H.cardLines({ nameJa: "ハマナス", jaLevel: "species", nameEn: "Rugosa rose", scientificName: "Rosa rugosa", score: 0.816 });
  assert.equal(l.name, "ハマナス");
  assert.equal(l.sub, "Rugosa rose ・ Rosa rugosa");
  assert.equal(l.score, "確からしさ 82%");
  assert.match(l.source, /Wikipedia/);
  const l2 = H.cardLines({ nameEn: "Daisy", scientificName: "Bellis perennis", score: 0.5 });
  assert.equal(l2.sub, "Bellis perennis");
  assert.doesNotMatch(l2.source, /Wikipedia/);
});

test("5:7 の寸法と、真ん中の正方形", () => {
  assert.equal(H.CARD.width * 7, H.CARD.height * 5);
  assert.deepEqual(H.centerSquare(4000, 3000), { sx: 500, sy: 0, size: 3000 });
  assert.deepEqual(H.centerSquare(3000, 4000), { sx: 0, sy: 500, size: 3000 });
});
