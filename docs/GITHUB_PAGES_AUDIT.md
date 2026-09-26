# GitHub Pages / iPhone PWA 配信監査

対象: 既存Prompt Tree v4。現行マスター仕様は `PROMPT_TREE_MASTER_SPEC_v4_LOCAL_OFFLINE.md`。2026-09-26の配信対応。

## 配信構成

| 項目 | 設定・確認方法 |
| --- | --- |
| 配信物 | `dist/` のHTML/CSS/JS/アイコン/manifest/SWのみ |
| Vite base | `./`。リポジトリ名を固定しない相対URL。rootとproject siteで同じ成果物を使う |
| Router | 既存HashRouterを維持。`/<repository>/#/cards/...` の直接アクセスにサーバー側rewriteは不要 |
| Manifest | `id` / `scope` / `start_url` は `./`、`display: standalone`、`lang: ja` |
| Icons | 192/512px、apple-touch-icon、SVGを同梱。外部URLなし |
| Service Worker | vite-plugin-pwa generateSW / prompt更新。全app chunk（遅延読み込み・HEIC処理含む）をprecache |
| Offline | 初回オンライン保存後に、配信元を遮断して再読込・PIN解除・画像表示を確認 |
| 公開対象 | main push / workflow_dispatch → 検査 → build → E2E → distをartifact化 → deploy |
| 権限 | buildはcontents:readのみ。deployにpages:writeとid-token:write |
| ユーザーデータ | IndexedDB / OPFSのみ。アップロード・同期・サーバーAPIを追加していない |

相対baseはVite公式の対応方式です。HashRouterでは画面パスがhash内にあり、文書のパスは常に配信ルートのままです。`/home` 等のHistory Router向け404回避ファイルは不要です。共有するURLはアプリに表示される `#/...` の形式を使います。

## 変更範囲

- `vite.config.ts`: 相対baseの理由、manifestの識別子・scope・言語、古いprecacheの清掃を明示。
- `index.html`: iPhone向けWebアプリ名・表示メタデータを追加。
- `PwaStatus.tsx`: 初回起動タブを開いたまま新版が来るケースの更新後reloadを補正。Workboxは登録時点にcontrollerがあったかでisUpdateを判断するため、初回タブではユーザーが更新を選んだときのcontrollerchangeを補完する。編集中の確認と「あとで」は維持。
- `.github/workflows/pages.yml`: 無料の静的配信用workflow。main以外からの公開は拒否。
- `scripts/audit-static.mjs`: 成果物のallowlist、秘密情報の代表的な形式、クラウドruntime/API署名、相対asset参照、manifest、依存とアプリソースの通信APIを検査。
- `pnpm-workspace.yaml`: 既に削除済みのworkerdをビルド許可リストからも除外。
- `e2e/pages.spec.ts` / static fixture: project subpath、通信監査、静的SWの更新、直接URL、Backup/Restore、オフライン再読込を追加。
- `scripts/package-release.mjs`: 公開用source ZIPへworkflowを含める。従来どおり秘密ファイル・ローカル作業領域を含めない。

HOME / TREE / Gallery / Detail / Editor / PIN / 保存モジュール / DB schema / Backup / Restoreの実装を作り直していません。

## テスト内容と結果

2026-09-26、Windows / Node.js 24.19.0 / pnpm 11.19.0で最終確認。

| 検査 | 結果 |
| --- | --- |
| Typecheck | PASS |
| Lint | PASS |
| Unit / repository test | 18件 PASS |
| E2E | 32件 PASS（Chromium 16 / WebKit 16） |
| Production build | PASS、precache 32 entries、約2.1MiB |
| Static audit | PASS、配信ファイル32件 |
| Workflow | YAML解析、main条件、build成功依存、dist限定を確認。GitHub上での実行は未確認 |
| Lockfile | pnpm frozen / offline lockfile検査 PASS |
| 実機iPhone | **未確認** |

最終E2E: 418秒、失敗0・skipped 0・flaky 0。既存の30件にPages向け2件を追加。型チェック・lint・単体テストも最終実装で再実行済み。HEIC decoder同梱によるchunkサイズ警告と既存の動的import警告は残るが、buildは成功し、外部読み込みは追加していない。

Pagesシナリオの通信記録はChromium 98件、WebKit 71件。すべて同じproject mount内の静的ファイルGETで、外部originへの通信・ユーザーデータAPI・POSTは0件。SWのprecacheと更新確認を含むため、アプリ本体取得の通信は発生する。テスト対象操作と検出条件は以下のとおり。

新しいPages E2Eは、rewriteもAPIも持たない静的HTTPサーバーの `/Prompt-Tree-v4/` だけにproduction buildを配置します。以下をChromiumとWebKitで行います。

1. PIN初期設定、manifest/iconの取得、SWのscriptURL・scopeを確認。
2. HOMEからSeries/Cardを作り、PromptとOriginal画像2枚を保存。
3. TREEは1ノード、Galleryは画像2件であることを確認。
4. TREEをpanし、Detailから戻ってviewportが一致し、本体スクロールが0であることを確認。
5. Gallery→ViewerでFavoriteを変更し、SearchでPromptを検索。
6. Settingsで完全バックアップを保存し、同ファイルから復元。
7. 同一originでバイト列を変更したテスト用SWを配信し、実際の更新ボタンで切り替える。PIN解除とCard・Original数を確認。
8. 復元後のCardの直接URLを別文書から開き、200で起動することを確認（復元は既存仕様どおりIDを再生成するため、復元前のURLは使わない）。
9. 配信元を遮断して再読込し、PIN解除、Prompt・Original・Favoriteを確認。
10. 開始からのHTTPリクエストがすべて同じproject mount内の静的asset GETであることを検査。APIや外部origin、POST、ユーザー値を載せるqueryは拒否。通信一覧をテスト結果に添付。

WebKitではPlaywrightのoffline設定とSW応答に既知の制約があるため、実際のローカル配信サーバーを停止して到達不能にします。Chromiumではネットワークofflineを使用します。どちらも物理iPhoneの機内モード実測ではありません。

## 公開・実機確認の境界

- この作業ではGitHubリポジトリ作成・push・Pages公開は行っていません。実際のGitHub Actions runnerでの実行は未確認です。
- ローカル検証対象はproduction buildを載せた静的サーバーです。GitHub Pages本番URLでの確認は、利用者が公開した後に行います。
- 実機iPhoneのSafari・ホーム画面追加・機内モード・写真共有は **未確認** です。
- クラウドサービスの有効化、Worker deploy、Remote D1、外部API、有料サービス追加は行っていません。
- 再deployでIndexedDB/OPFSを消す処理はありません。ただしorigin変更、手動のサイトデータ削除、OSの容量回収、端末故障は別です。公開URLを固定し、完全バックアップを保持します。

公開とインストールは [1手順ずつの案内](GITHUB_PAGES_IPHONE.md) を参照してください。
