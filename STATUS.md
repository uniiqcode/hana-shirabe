# 現状メモ（セッション間の引き継ぎ用）

新しいセッションは、最初にこのファイルを読む。作業や相談で状況が変わったら、最後にこのファイルを更新する。

最終更新: 2026-11-28

## 今の状況

- 2026-11-27: にいさんが「写真やカメラから花の名前を調べるアプリ」を依頼。名前を hana-shirabe（花しらべ）に決定
- 2026-11-27: にいさんが github.com でリポジトリ `uniiqcode/hana-shirabe`（非公開）を作成
- 2026-11-27: niisan-tv の仕組みを調べ、計画を作成 → `docs/plan.md`（PR #1 マージ済み）
- 2026-11-27: 試作を作成（PR #2 マージ済み）。画面（`index.html`・`app.js`・`style.css`）と中継（`worker/worker.js`）。中継の住所が `config.js` に無いあいだは「お試し表示」（見本の答え）で動く。ネットにつながないテストは `npm test`（12件）
- 2026-11-28: にいさんが Cloudflare に中継 `hana-shirabe` を置き、Pl@ntNet のキーを秘密の値 `PLANTNET_API_KEY` に入れた（キーはアカウントに1つだけなので niisan.tv と共用）。住所 `https://hana-api.uniiqcode.com`（「relay: ok」を確認）。`config.js` に入れた

## 次にやること

1. にいさん: リポジトリを公開にして GitHub Pages を有効にし（`docs/setup.md` の手順3）、iPhone で試す
2. 試した結果で直す（候補の数、撮り方の案内、見た目）

## 未決（にいさんの判断待ち）

- 公開に切り替える時期（無料プランでは非公開のままだと GitHub Pages で試せない）
