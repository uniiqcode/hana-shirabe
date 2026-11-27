# にいさんの手順: 中継を置いて、花しらべを動かす

試作のページは、中継が無いあいだ「お試し表示」（見本の答え）で動く。本当に名前を調べるには、次の3つが要る。

## 1. Pl@ntNet の API キー

niisan.tv で使っている Pl@ntNet のアカウントをそのまま使う（無料のアカウントは1人1つの決まり）。

1. https://my.plantnet.org/ を開いてログインする
2. アカウントの設定の画面で、API キーの欄を見る。新しいキーを足せるなら「花しらべ用」に1つ足す。足せなければ、今のキーを使う
3. キーは次の手順2で Cloudflare に貼るだけ。チャットやリポジトリには貼らない

1日500回の枠は、アカウントで共有になる見込み（要確認）。niisan.tv の毎晩の処理は、まだ名前を調べていない写真があるときだけ使うので、新しい写真を足さない日はほぼ0回。

## 2. Cloudflare に中継を置く

1. https://dash.cloudflare.com/ を開いてログインする（uniiqcode.com を置いているアカウント）
2. 左のメニューの「Workers & Pages」（または「Compute」→「Workers & Pages」）を押す
3. 「作成」（Create）→「Hello World から始める」（Start with Hello World）を押す
4. 名前に `hana-shirabe` と入れて「デプロイ」（Deploy）を押す
5. 「コードを編集」（Edit code）を押す。左の `worker.js` の中身を全部消して、このリポジトリの [`worker/worker.js`](../worker/worker.js) の中身を全部貼る → 右上の「デプロイ」を押す
6. いったん戻り、「設定」（Settings）→「変数とシークレット」（Variables and Secrets）→「追加」（Add）を押す
   - 種類: 「シークレット」（Secret）
   - 名前: `PLANTNET_API_KEY`
   - 値: 手順1のキー
   - 「デプロイ」を押す
7. 画面に出る住所（`https://hana-shirabe.〜.workers.dev`）をねえさんに伝える。ねえさんが `config.js` に入れる

確かめ方: その住所をブラウザで開いて「hana-shirabe relay: ok」と出れば中継は動いている。

画面の名前は Cloudflare の変更で少し違うことがある。迷ったらその画面を写真で送ってもらえれば案内する。

## 3. ページを公開する

GitHub の無料プランでは、非公開のリポジトリは GitHub Pages で公開できない。iPhone で試すには、リポジトリを公開にする必要がある（キーはリポジトリに入っていないので、公開しても安全）。

1. https://github.com/uniiqcode/hana-shirabe を開く →「Settings」
2. いちばん下の「Danger Zone」→「Change repository visibility」→「Change visibility」→「Make public」を選んで確かめる
3. 左のメニューの「Pages」→「Build and deployment」の「Source」で「Deploy from a branch」、「Branch」で `main` と `/ (root)` を選んで「Save」
4. 数分待って https://uniiqcode.com/hana-shirabe/ を開く

中継は https://uniiqcode.com からの呼び出しだけを受け付ける（`ALLOWED_ORIGINS` を変えれば、ほかの住所も足せる）。
