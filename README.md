# 花しらべ（hana-shirabe）

写真やスマホのカメラから、花の名前を調べるウェブアプリ。

- 撮る、または写真を選ぶ → 名前の候補を3つほど、和名・英名・確からしさと一緒に出す
- 公開先（予定）: https://uniiqcode.com/hana-shirabe/ （ホーム画面に追加できる形）
- 名前を当てるのは [Pl@ntNet](https://my.plantnet.org/)（植物の名前を当てる専門のサービス）。和名は Wikidata から日本語版 Wikipedia の題名を引く

計画は [`docs/plan.md`](docs/plan.md)、今の状況は [`STATUS.md`](STATUS.md)。

元になった仕組みは niisan.tv の花のデータベース（`uniiqcode/niisan-tv` の `backend/uniiqcode/identify_flowers.py`）。
