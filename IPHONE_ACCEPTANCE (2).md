> DEPRECATED — DO NOT FOLLOW FOR v4
> 旧クラウド版の履歴資料です。現行仕様は ../PROMPT_TREE_MASTER_SPEC_v4_LOCAL_OFFLINE.md です。

# Physical iPhone acceptance

状態: 未実施。iPhone実機および公開HTTPS URLが必要です。

実施時は端末/iOSバージョン、Safari/Standalone、日時、結果を記録してください。

- [ ] Safariとホーム画面PWAでOwner login → PIN、PIN変更、全端末logout
- [ ] 5分無操作でロック、操作中は継続、バックグラウンドで内容を隠す
- [ ] ノッチ・ホームインジケーター・キーボード表示時に主要ボタンが操作可能
- [ ] 写真からJPEG/PNG/WebP/HEICを選び、1 Cardへ5枚以上保存
- [ ] Originalをdownload/shareして元ファイルとバイト/解像度を比較
- [ ] 部分upload失敗→成功分保持→失敗分再試行、通信断/再起動時の復旧
- [ ] HOME長押し並べ替え、Rootだけが並び順保存される
- [ ] TREEはSeriesごと独立、指パン・ピンチ、短タップでDetail、長押し後のみ移動
- [ ] TREEの上下左右端でページ本体が1pxもスクロールしない
- [ ] TREE→Detail→戻るの位置/zoomが完全一致、連続20回でもずれない
- [ ] 縦横回転してもCard座標は不変、見ている領域を保持
- [ ] 多親、Primary切替、Reference、線の色、循環拒否、Undo/Redo
- [ ] IMAGESは1画像1セル、momentum scroll、favorite/日付/Series絞り込み
- [ ] Viewer左右swipe、ピンチ、閉じる→元の一覧位置、TREEで表示
- [ ] 検索結果→Detail→戻るでquery/位置保持
- [ ] オフラインPIN・キャッシュ閲覧・編集不可、オンライン復帰
- [ ] Dark mode、テキスト拡大、44px以上の主要タップ領域
- [ ] ZIPのpartごとdownload、CSV文字化けなし、Original再圧縮なし
- [ ] 更新通知を承諾するまで編集中の内容を失わない

自動テスト結果は `IMPLEMENTATION_STATUS.md` 参照。実機結果を推定でチェックしないでください。
