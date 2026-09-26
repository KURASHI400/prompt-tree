# Prompt TreeをGitHub Pagesで公開し、iPhoneへ追加する

GitHub Pagesはアプリ本体を配るためだけに使います。画像、Prompt、Card、TREE、タグ、メモ、PINは端末内に保存されます。アカウント登録、APIキー、Cloudflare、サーバーDBは不要です。

この手順のGitHub Freeでの公開には **Publicリポジトリ** を使います。公開されるソースにはユーザーデータを含めません。GitHub Actionsによるビルド時のパッケージ取得は開発用であり、アプリからユーザーデータを送る機能ではありません。

## 1. GitHub上に公開用リポジトリを作る

1. GitHubへログインします。
2. 右上の「＋」→「New repository」を押します。
3. Repository nameに `prompt-tree` などの名前を入力します。一度使い始めたら変更しない名前にしてください。
4. Visibilityは「Public」にします。
5. 「Add a README file」をONにして、「Create repository」を押します。READMEの追加で初期ブランチを作れます。
6. 「Code」画面の左上のブランチ名が **main** になっていることを確認します。別名なら、ブランチ一覧でそのブランチを `main` に変更します。このworkflowはmainへの更新を公開します。

GitHub Pages/Actionsを使える設定・アカウントであることが必要です。支払い情報や有料サービスはこのアプリの実行に不要です。

## 2. 配布されたソースをアップロードする

1. Pages対応版の `PromptTree-v4-source.zip` をPCに保存し、右クリック→「すべて展開」で展開します。
2. GitHubのリポジトリで「Add file」→「Upload files」を開きます。
3. 展開したフォルダの **中身** をアップロード欄へドラッグします。ZIPそのものや外側のフォルダをアップロードしないでください。
4. `.github` フォルダも含めて選択してください。GitHub上で最終的に `.github/workflows/pages.yml` と `package.json` がリポジトリ直下から見える必要があります。
5. ファイル数制限が表示された場合は2回に分けます。途中の自動実行が失敗しても、全ファイルを配置した後に再実行できます。
6. 「Commit changes」を押し、mainへ保存します。既存のREADMEは配布版のREADMEで置き換えます。

**元の作業フォルダ全体をアップロードしないでください。** 配布ZIPはソースを選別しています。`.dev.vars`、`.env`、`.wrangler`、`work`、バックアップ、個人の画像、`node_modules`、ブラウザのデータは含めません。`PromptTree-v4-static.zip` はビルド済みアプリの控えであり、このActions方式にはsource ZIPを使います。

## 3. Pagesの公開方法を選ぶ

1. リポジトリの「Settings」を開きます。
2. 左側の「Pages」を押します。
3. 「Build and deployment」の「Source」を **GitHub Actions** にします。
4. 上部の「Actions」を開きます。初回にworkflowの有効化を求められた場合は有効にします。
5. 左側の **Publish Prompt Tree to GitHub Pages** を選びます。
6. 「Run workflow」を押し、Branchが `main` であることを確認して実行します。
7. 実行が完了するまで待ちます。`build` と `deploy` の両方に緑のチェックが付けば公開成功です。
8. 「Settings」→「Pages」に戻り、「Visit site」を押します。公開URLは通常 `https://ユーザー名.github.io/prompt-tree/` です。

以後、mainに変更をpushすると自動で検査と公開が走ります。途中の検査が失敗した場合、その変更は公開されません。公開ファイルは `dist/` のHTML/CSS/JS/アイコン等のみです。

## 4. iPhoneへインストールする

最初はオンラインで行います。実データを登録する前にホーム画面への追加を済ませてください。

1. **Safari** で上記のGitHub Pages URLを開きます。末尾の `/` を含めたURLを使います。
2. Safariの **共有** を押します。
3. **「ホーム画面に追加」** を選びます。見当たらない場合は共有メニューを下へスクロールします。
4. **「Webアプリとして開く」** を **ON** にします。
5. **「追加」** を押します。
6. ホーム画面の **Prompt Treeアイコン** から起動します。
7. 表示に従って4桁PINを設定します。Safariで設定済みでも、ホーム画面側が初期状態なら、ホーム画面側で設定してください。
8. 安定した通信状態で起動し、ホームや設定が表示されるまで待ちます。初回はアプリ一式の保存に時間がかかることがあります。

iOSのバージョンによってメニューの配置や表記が異なることがあります。ホーム画面からの起動とSafariタブは、同じ保存領域になると決めつけず、以後はアイコンから使います。

## 5. オフライン起動を実機で確かめる

1. アイコンからオンラインで一度正常起動した後、テスト用のSeriesと画像付きCardを1つ作ります。
2. アプリを終了します。
3. 機内モードをONにします。Wi-Fiが残っている場合はWi-FiもOFFにします。
4. Prompt Treeアイコンを押して再起動します。
5. PIN解除後に作成したCardとOriginal画像が見えることを確認します。
6. Prompt編集、画像追加、TREE移動、お気に入り、検索、設定のBackup/Restoreを確認します。
7. 確認後、機内モードを解除します。

起動しない場合はオンラインへ戻し、アイコンから再起動してアプリの保存が終わるまで待ち、もう一度試します。**実データを保持したまま、安易にSafariのWebサイトデータを消したりアプリを削除したりしないでください。**

開発側では静的配信・Service Worker・通信遮断の自動テストを行っていますが、**実機iPhoneでのインストールや機内モード確認は未実施**です。詳しい確認項目は [実機チェックリスト](IPHONE_ACCEPTANCE.md) にあります。

## 6. データを失わず更新する

- GitHubのユーザー名、リポジトリ名、公開URLを固定して運用します。カスタムドメインへの変更も、バックアップなしでは行わないでください。
- 同じorigin（例 `https://ユーザー名.github.io`）の通常の再deployでは、IndexedDB / OPFSは削除されません。今回の配信設定には保存領域の初期化処理を追加していません。
- 新版の案内が出たら、編集中の内容を保存して「更新」を押します。更新を後回しにして、手元の版をオフラインで使うこともできます。
- データの保存単位はoriginです。同じユーザー名の他のPagesプロジェクトも同一originなので、信頼できないアプリを同じoriginへ置かず、Prompt Treeの複数コピーを別々の保存庫として使わないでください。
- OSやブラウザによるデータ削除、容量不足、端末故障まで防ぐものではありません。「設定」→「完全バックアップを作成」で全PartをFiles等に保存し、別の安全な場所にも控えを残します。
- PINはローカル画面ロックです。忘れたPINをGitHubで再発行する機能はありません。

## PCの既存データをiPhoneへ移す

PCのローカルURLとGitHub Pagesは別の保存場所です。公開しても既存データは自動で移りません。PC版の設定から完全バックアップの全Partを保存し、Files等でiPhoneに持ち込み、**ホーム画面のアイコンから起動したアプリ**の「バックアップから復元」で全Partを選びます。既にiPhoneにデータがある場合は、復元前にその端末もバックアップしてください。

## 公開に失敗した場合

- Actionsが見当たらない: `.github/workflows/pages.yml` が正しい位置にあるか確認します。
- Pagesのdeployが失敗: Settings → Pages → SourceがGitHub Actionsか、実行ブランチがmainか確認します。
- 404: 初回公開が完了しているか、Pagesの「Visit site」のURLを使っているか確認します。画面のURLは `/prompt-tree/#/home` のように **#** が付きます。`/prompt-tree/home` というURLは使いません。
- 白い画面: ZIPを1つのフォルダに包んだままアップロードしていないか確認し、Actionsの失敗したステップを確認します。
- テスト失敗: Actionsの該当ステップのログを確認します。検査を削除して公開を強行しないでください。

## 公式資料

- [GitHub Pagesの公開元を設定する](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [GitHub Pagesのカスタムworkflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Apple: SafariのWebサイトをiPhoneのアプリにする](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/27/ios/27)
- [Vite: 相対base](https://vite.dev/guide/build.html#relative-base)
