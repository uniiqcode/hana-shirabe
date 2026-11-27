// アイコン一式を作る: node scripts/make-icons.cjs
//   icons/icon.svg    → icon-192.png・icon-512.png・apple-touch-icon.png（ホーム画面）
//   icons/favicon.svg → favicon-32.png・favicon-16.png（ブラウザのタブ。小さくても見えるよう簡略版）
//   icons/ogp.html    → ogp.png（SNS で共有した時のバナー 1200×630）
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "..", "icons");
const icon = fs.readFileSync(path.join(dir, "icon.svg"), "utf8");
const fav = fs.readFileSync(path.join(dir, "favicon.svg"), "utf8");

(async () => {
  const b = await chromium.launch();
  const shots = [
    [icon, "icon-192.png", 192],
    [icon, "icon-512.png", 512],
    [icon, "apple-touch-icon.png", 180],
    [fav, "favicon-32.png", 32],
    [fav, "favicon-16.png", 16],
  ];
  for (const [svg, name, size] of shots) {
    const p = await b.newPage({ viewport: { width: size, height: size } });
    await p.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
    await p.screenshot({ path: path.join(dir, name), omitBackground: true });
    await p.close();
  }
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await p.goto("file://" + path.join(dir, "ogp.html"));
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(dir, "ogp.png") });
  await b.close();
})();
