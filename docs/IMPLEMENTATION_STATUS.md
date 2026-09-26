# v4 ローカル移行記録

GitHub Pages向け配信対応は [追加監査記録](GITHUB_PAGES_AUDIT.md) を参照してください。この文書の30件という件数はPages対応前の移行完了時点の記録です。

唯一の現行マスター仕様: `PROMPT_TREE_MASTER_SPEC_v4_LOCAL_OFFLINE.md`。
移行手順: `PROMPT_TREE_CODEX_MIGRATION_PROMPT_v4_FROM_CURRENT_SOURCE.md`。

## Phaseと安全対策

- Phase A: deploy・D1 migrate・Worker起動を実行経路から除外。静的previewへ変更。
- Phase B–E: 型付きローカルモジュール、IndexedDB、workspace、OPFSとfallback、schema upgradeを実装。
- Phase F: 既存画面のデータ取得をrepositoriesへ置換。PIN、オフライン書き込み、容量管理、分割Backup/Restoreを実装。検証で見つかった保存互換性・画面状態・大量画像取得の問題を修正。
- Phase G: 旧Worker、migration、デプロイ設定、旧API、旧クラウド専用テストと依存を除去。旧資料をlegacy-cloudへ退避。

移行前のローカル旧DBはusers/series/cards/card_images/edgesが0件であることを読み取り専用で確認した。既存の`.wrangler/state`、実際の`.dev.vars`、`work/`は削除していない。Gitは未コミット状態だったため、削除前に100ファイルのソース退避を`work/backups/pre-v4/source.zip`へ作成した。秘密ファイルはZIPから除外した。pushやリモートデータ操作はしていない。

## 再利用と変更

再利用: `Home.tsx`のSeries一覧とDnd、`Tree.tsx`のReact Flow/gesture/overlay/viewport、`Gallery.tsx`のvirtualizer、`Detail.tsx`、`Editor.tsx`、`ImageControls.tsx`、`Viewer.tsx`のPhotoSwipe、`domain.ts`、`history.ts`、`style.css`、HEIC thumbnail処理。

置換: `useData.ts`を型付きloaderへ変更。各画面のAPI呼び出しを`src/local/repository/*`へ変更。`Thumb.tsx`はObject URLとLRU。`AuthGate.tsx`はローカルPINと5分lock。`Settings.tsx`は容量/PIN/Backup/Restore/Reset。`PwaStatus.tsx`はオフラインを正常動作として扱う。`main.tsx`はHashRouter。

削除: `worker/*.ts`、`migrations/*.sql`、`wrangler.jsonc`、`wrangler.production.jsonc`、`.dev.vars.example`、`src/api.ts`、`src/cache.ts`、`src/Invitations.tsx`、旧Worker起動/seed/Owner復旧スクリプト、旧server認証・APIのテスト。`wrangler`と`@cloudflare/workers-types`を依存から除去。

## ローカル構成

IndexedDB `prompt-tree-local`のversion 2。researchレコードをworkspace_idで分離し、controlにactive_workspace_id、securityにPIN検証値を持つ。OPFSのUUIDパスでOriginalをそのまま保持し、WebPサムネイルを分離する。OPFS書き込みが使えない場合はIndexedDB Blob、Blob保存が使えないWebKitでは原本のArrayBufferへ切り替える。二重保存やbase64化はしない。

Galleryは256件までのメタデータをまとめて読み、1ページ120件を返す。Reactへ1万画像を一括投入せず、仮想表示する。Viewerは表示時に原本を読み、不要なObject URLを解放する。検索は200 Cardずつ処理してイベントループへ制御を返す。

削除はmetadataのsoft deleteとcleanup queueを使用する。短時間のUndoを提供し、Originalは1時間の猶予後に清掃する。復元時は別workspaceへstageし、すべての書き込みと検証が成功した後でactive workspaceを切り替える。旧領域の清掃は24時間後以降。

## Backup / Restore

format version 1の.ptbackup ZIP。16MiB目安のPartを順番に生成し、Originalは4MiB単位で分割する。manifest、件数、参照、サイズ、メタデータとOriginalのSHA-256を検証する。巨大なメタデータもPartへ分割する。サムネイルは復元時に再生成でき、PINは含めない。

テストでは複数Series、Root/派生、複数親、Reference、タグ、評価、座標、viewport、原本バイトを照合した。Part不足・原本破損・途中書き込み失敗で既存workspaceが変わらないことを検証した。

## 検証

Phase G最終ゲート（2026-09-26）: **自動テスト PASS**。

| 検証 | 結果 |
|---|---|
| TypeScript typecheck | PASS |
| ESLint | PASS |
| Unit / repository integration | 18 / 18 PASS |
| Playwright Chromium | 15 / 15 PASS |
| Playwright WebKit | 15 / 15 PASS |
| Production static PWA build | PASS |
| Runtime / dependency cloud audit | 旧API・Worker・D1/R2・Wrangler参照なし |
| 実機iPhone | **未確認** |

最終E2Eは計30件、失敗0・スキップ0・flaky 0（約6分26秒）。1万画像の仮想表示・絞り込み・Gallery復帰、オフラインCRUD、TREEの20回往復とviewport一致・body scroll 0・長押し・pinch・Undo・縦横切替、原本バイト一致、PINと5分lock、バックアップの正常/破損復元、ブラウザを閉じた後の保存、OPFS fallback、容量不足、永続ストレージ3状態、サブディレクトリでのオフライン再起動を含む。

最終ビルドでは32アセット（約2.1MiB）をprecacheする。HEIC decoderはローカル同梱のため約1.35MBのchunkサイズ警告が出るが、ビルドは成功し、外部CDNから読み込まない。

各段階でtypecheck、lint、unit/repositoryテスト、production build、関連E2Eを実行し、不具合を修正した。旧クラウド専用テストはローカル検証へ置換した。

Chromiumではブラウザのoffline mode、Windows WebKitでは実際のテスト用originサーバー停止でオフラインを検証する。理由は[Playwright #42775](https://github.com/microsoft/playwright/issues/42775)のService Worker応答を遮断する問題であり、アプリの保存処理を模擬APIで置き換えたものではない。ブラウザプロファイルを閉じて再起動する永続化テストも含む。

productionにはテスト用のwindow.localTestやAPI backdoorを含めない。テスト補助コードはe2e/local-helper.tsを別途bundleして注入する。

`scripts/package-release.mjs`でソースZIPと静的アプリZIP、SHA-256一覧を作成できる。秘密ファイル、端末データ、work、依存フォルダ、Git管理情報は含めない。

## iPhoneと配置

**実機iPhone: 未確認**。WebKit自動テストのみで実機対応完了とは判断しない。`IPHONE_ACCEPTANCE.md`で機内モード起動、HEIC、Files共有、touch gesture、容量、ダークモード等を確認する。

distはバックエンド不要の静的PWA。ルートとサブディレクトリ配置を検証する。公開デプロイはしていない。利用者の画像・Promptを別originへ自動移行しない。

## 課金とネットワーク

このv4実装にCloudflare R2/D1/Workersの課金runtimeは不要。移行中にR2有効化、production Worker deploy、remote D1操作、課金サービス追加は一切行っていない。APIキーは使用・保存しない。
