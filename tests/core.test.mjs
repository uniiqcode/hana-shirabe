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

test("写真は左右と上に余白なし", () => {
  assert.equal(H.CARD.photo, H.CARD.width);
  assert.ok(H.CARD.height - H.CARD.photo >= 500); // 下に文字の帯
});

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test("はじめの表示は枠をちょうど埋めて真ん中", () => {
  const v = H.initialView(4000, 3000, 300); // 横長
  close(v.scale, 0.1);
  close(v.x, -50); close(v.y, 0);
  const r = H.cropRect(v, 300);
  close(r.sx, 500); close(r.sy, 0); close(r.size, 3000);
});

test("小さくしすぎ・動かしすぎは、すき間ができない所で止まる", () => {
  const v = H.clampView({ scale: 0.01, x: 100, y: 100 }, 4000, 3000, 300);
  close(v.scale, 0.1); close(v.x, 0); close(v.y, 0);
  const v2 = H.clampView({ scale: 0.1, x: -9999, y: -9999 }, 4000, 3000, 300);
  close(v2.x, -100); close(v2.y, 0);
  const v3 = H.clampView({ scale: 99, x: 0, y: 0 }, 4000, 3000, 300, 6);
  close(v3.scale, 0.6);
});

test("つまんだ点を中心に拡大する", () => {
  const v0 = H.initialView(3000, 3000, 300); // scale 0.1, x=y=0
  const v = H.zoomAt(v0, 2, 150, 150, 3000, 3000, 300);
  close(v.scale, 0.2);
  close(v.x, -150); close(v.y, -150); // 真ん中は真ん中のまま
  const r = H.cropRect(v, 300);
  close(r.sx, 750); close(r.size, 1500);
});
