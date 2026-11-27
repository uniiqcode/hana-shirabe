# 花しらべ（hana-shirabe）

写真やスマホのカメラから、花の名前を調べるウェブアプリ。

- 撮る、または写真を選ぶ → 名前の候補を3つほど、和名・英名・確からしさと一緒に出す
- 公開先（予定）: https://uniiqcode.com/hana-shirabe/ （ホーム画面に追加できる形）
- 名前を当てるのは [Pl@ntNet](https://my.plantnet.org/)（植物の名前を当てる専門のサービス）。和名は Wikidata から日本語版 Wikipedia の題名を引く

計画は [`docs/plan.md`](docs/plan.md)、今の状況は [`STATUS.md`](STATUS.md)、中継を置く手順は [`docs/setup.md`](docs/setup.md)。

## ファイル

| ファイル | 役目 |
|---|---|
| `index.html`・`app.js`・`style.css` | 画面（撮る・選ぶ → 写真を小さくして中継へ → 候補を表示） |
| `config.js` | 中継の住所。空だと「お試し表示」 |
| `worker/worker.js` | 中継（Cloudflare Workers）。Pl@ntNet に問い合わせ、Wikidata で和名を引く |
| `tests/` | ネットにつながないテスト（`npm test`） |
| `icons/`・`manifest.webmanifest` | ホーム画面のアイコン（`node scripts/make-icons.cjs` で `icon.svg` から作る） |

元になった仕組みは niisan.tv の花のデータベース（`uniiqcode/niisan-tv` の `backend/uniiqcode/identify_flowers.py`）。
