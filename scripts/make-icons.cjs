const { chromium } = require("playwright");
const fs = require("fs");
// icons/icon.svg から PNG のアイコンを作る: node scripts/make-icons.cjs
const dir = require("path").join(__dirname, "..");
const svg = fs.readFileSync(dir + "/icons/icon.svg", "utf8");
(async () => {
  const b = await chromium.launch();
  for (const [n, s] of [["icon-192.png", 192], ["icon-512.png", 512], ["apple-touch-icon.png", 180]]) {
    const p = await b.newPage({ viewport: { width: s, height: s } });
    await p.setContent(`<style>html,body{margin:0}svg{display:block;width:${s}px;height:${s}px}</style>${svg}`);
    await p.screenshot({ path: `${dir}/icons/${n}` });
  }
  await b.close();
})();
