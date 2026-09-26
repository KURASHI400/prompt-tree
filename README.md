# Prompt Tree v4

iPhoneを中心に、画像と生成Promptの実験を整理するローカル専用PWAです。**1 Card = 1 generation experiment**。1 Cardに複数のOriginal画像を保存し、TREEにはCardを1つ、IMAGESには各画像を表示します。

唯一の現行マスター仕様は [v4 LOCAL OFFLINE仕様](docs/PROMPT_TREE_MASTER_SPEC_v4_LOCAL_OFFLINE.md) です。[移行手順](docs/PROMPT_TREE_CODEX_MIGRATION_PROMPT_v4_FROM_CURRENT_SOURCE.md) に沿って、既存のHOME・TREE・Gallery・Detailを再利用しています。

## GitHub Pagesで公開してiPhoneへ追加

[初心者向けの公開・iPhoneインストール手順](docs/GITHUB_PAGES_IPHONE.md) を参照してください。`main`へのpushで検査・ビルド・E2Eを行い、合格した`dist/`だけをGitHub Pagesへ配信します。リポジトリ名の設定変更やAPIキーは不要です。画像やPromptの保存先は引き続きiPhone内だけです。

[配信設定と検証内容](docs/GITHUB_PAGES_AUDIT.md)。実機iPhoneでの確認は未実施です。

## 起動と開発

Node.js 22以降とpnpmを使用します。検証環境はNode.js 24です。

```sh
pnpm install
pnpm run dev
```

オフライン検証にはproduction buildとpreviewを使います。

```sh
pnpm run build
pnpm run preview
```

ブラウザで http://127.0.0.1:4173/ を開きます。APIキー、アカウント、バックエンド、データベースサーバーは不要です。

## 検証

```sh
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build
pnpm run audit:static
pnpm exec playwright install chromium webkit
pnpm run test:e2e
```

Playwrightはビルド済みdistをpreviewで起動します。work/browsersにブラウザがある場合は自動利用します。Windowsではscripts/check.ps1でも一括実行できます。テスト専用のデータ確認用コードはe2e内から注入し、productionには含めません。

## 保存方式

- IndexedDB「prompt-tree-local」: Card、Series、接続、タグ、設定、下書き、PIN検証値。
- OPFS: Originalの元バイトと別生成したWebPサムネイル。表示用IDをファイルパスに使いません。
- OPFSの書き込みが使えない場合: IndexedDBへBlobを保存。Blob保存非対応の環境では同じ原本バイトをArrayBufferとして保存します。base64化や両方式への二重保存はしません。
- active_workspace_idで有効な保存領域を管理します。復元は別領域への保存を完了してから切り替えます。
- 原本は1枚50MiBまで。サムネイル生成に失敗しても原本を保持し、設定から未完了保存の再試行・破棄ができます。

保存場所は「端末・ブラウザ・プロファイル・サイトのorigin」の組み合わせで分かれます。URLのホスト名やポートを変える前にバックアップしてください。端末間の同期や共有アカウントはありません。画像・Promptを外部へ自動送信しません。

## 使い方

HOMEでSeriesを作成し、複数画像とPromptを保存します。Seriesは長押しで並べ替えられます。

TREEはSeriesごとのInfinite Canvasです。1本指で移動、ピンチで拡大縮小、CardをタップしてDetail、長押しして位置を変更します。複数親・参照線・Undo/Redoを利用できます。Detailから戻っても同じviewportを保持し、TREE表示中はページ本体をスクロールさせません。

IMAGESは写真一覧です。画像ごとに表示し、Series・お気に入り・Root/Childで絞り込みます。大量画像はページ取得と仮想スクロールで表示します。ViewerからOriginalの保存・共有、Promptコピー、Detail/TREEへの移動ができます。

オフラインでも作成・編集・削除・画像追加・検索・TREE操作・バックアップができます。編集下書きは端末内に保存します。ページ再読み込み後にファイル選択は復元できないため、未保存の画像は再選択してください。

## PINとプライバシー

初回に4桁PINと確認値を設定します。PBKDF2とランダムsaltで検証値を保存し、平文PINは保存しません。失敗が続くと再試行を待つ必要があります。5分間の無操作、手動ロック、再読み込みでPIN入力に戻ります。バックグラウンドでは表示を隠します。

PINは画面のプライバシーロックであり、保存データの暗号化ではありません。PIN変更は設定から行います。PINを忘れた場合に備え、完全バックアップを別の安全な場所に保持してください。

## 永続ストレージと容量

初回と設定から永続ストレージを要求します。「有効」「未承認」「非対応」を区別して表示します。使用容量と空き容量はブラウザの推定値です。容量不足では保存成功として扱わず、既存Originalを保持してエラーを表示します。

永続ストレージが有効でも、端末故障・サイトデータ削除・アプリ削除からは保護されません。定期的な完全バックアップが必要です。

## 完全バックアップ

設定の「完全バックアップを作成」を押します。Original、Card、Series、親/参照接続、座標、タグ、評価、設定を含む.ptbackupファイルを作成します。形式はversion 1のZIPで、manifestとデータ件数、メタデータとOriginalのSHA-256を持ちます。PINは含みません。

1 Partの目安は16MiBで、大きなOriginalは4MiB単位に分割します。全ライブラリを巨大ZIPとしてメモリに保持せず、Partを1つずつ生成します。

1. 「このPartを保存」でFiles・iCloud Drive等へ保存します。
2. 実際の保存完了を確認し、「保存を確認・次のPart」を押します。
3. 最後に「全Partの保存を確認・完了」を押します。

すべてのPartを同じ場所に保管してください。途中のPartだけでは完全復元できません。Web Share非対応のブラウザではダウンロードを使います。自動バックアップではありません。

## 復元

設定の「バックアップから復元」で同一バックアップの全Partを選択します。形式・件数・参照・サイズ・ハッシュを検証し、確認後に復元します。

現在の保存領域を先に消しません。別のworkspaceへ原本とデータを書き込み、成功後にIndexedDBトランザクションで表示を切り替えます。失敗時は元のworkspaceのままです。旧領域・失敗した一時領域は24時間後以降のクリーンアップ対象です。現在のPINは維持します。新しい端末ではPINを設定してから復元してください。

## リセット

設定で「この端末のデータをリセット」を選び、DELETEと入力して確認します。対象アプリの画像・研究データ・PINを削除します。取り消せません。先にバックアップを保存してください。オフライン起動用のアプリ本体キャッシュは残る場合があります。

## 静的配置とiPhoneへのインストール

distの内容を安定したHTTPS originへ配置するだけで動きます。ルート配置とサブディレクトリ配置に対応し、HashRouterを使います。file://からの直接起動は使いません。この移行作業では公開デプロイを実施していません。

iPhoneではSafariで配置先を開き、初回読み込みとPIN設定を行い、「共有」→「ホーム画面に追加」でインストールします。ホーム画面から起動し、機内モードで再起動・作成できることを確認してください。PCの127.0.0.1はiPhoneから開けるアドレスではありません。

## 制限と実機確認

自動テストと実機iPhone確認は別です。**実機iPhoneは未確認**です。[確認チェックリスト](docs/IPHONE_ACCEPTANCE.md) と [移行記録](docs/IMPLEMENTATION_STATUS.md) を参照してください。

- Safariのストレージ保持、Files共有、HEICの描画はOS・端末・画像形式で差があります。
- HEIC用の変換コードはアプリに同梱します。Originalは変換・圧縮しません。
- 写真アプリへの保存はOSの共有メニュー等を使用します。
- Windows版Playwright WebKitでは、オフライン指定がService Worker応答を遮断する問題があるため、オフラインE2Eはテスト用originサーバー自体を停止して検証しています。
- ローカル保存のため、バックアップなしに消えたデータをサーバーから回復することはできません。

このv4実装にCloudflare R2/D1/Workersの課金runtimeは不要です。旧クラウドへの自動インポート、R2有効化、production Worker deploy、remote D1操作は行いません。
