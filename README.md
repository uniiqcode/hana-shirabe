# 花しらべ（hana-shirabe）

写真やスマホのカメラから、花の名前を調べるウェブアプリ。

- 撮る、または写真を選ぶ → 名前の候補を3つほど、和名・英名・確からしさと一緒に出す（同じ名前は確率の高い方だけ）
- 候補から名前をえらぶ → 花の写真の下に名前・確からしさ・出典を入れた 5:7 の画像を作り、写真に保存・SNS で共有できる
- 公開先: https://uniiqcode.com/hana-shirabe/ （`?demo` を付けると、写真を送らない「お試し表示」） （ホーム画面に追加できる形）
- 名前を当てるのは [Pl@ntNet](https://my.plantnet.org/)（植物の名前を当てる専門のサービス）。和名は Wikidata から日本語版 Wikipedia の題名を引く

計画は [`docs/plan.md`](docs/plan.md)、今の状況は [`STATUS.md`](STATUS.md)、中継を置く手順は [`docs/setup.md`](docs/setup.md)。

## ファイル

| ファイル | 役目 |
|---|---|
| `index.html`・`app.js`・`style.css` | 画面（撮る・選ぶ → 写真を小さくして中継へ → 候補を表示） |
| `core.js` | 画面に依らない処理（名前の出し方、同じ名前をまとめる、画像の文字と寸法） |
| `config.js` | 中継の住所。空だと「お試し表示」 |
| `worker/worker.js` | 中継（Cloudflare Workers）。Pl@ntNet に問い合わせ、Wikidata で和名を引く |
| `tests/` | ネットにつながないテスト（`npm test`） |
| `icons/`・`manifest.webmanifest` | アイコン一式（`node scripts/make-icons.cjs` で作る）。`icon.svg`＝ホーム画面（名札の付いた花）、`favicon.svg`＝タブ用の簡略版、`ogp.html`→`ogp.png`＝SNS で共有した時のバナー 1200×630 |

元になった仕組みは niisan.tv の花のデータベース（`uniiqcode/niisan-tv` の `backend/uniiqcode/identify_flowers.py`）。
