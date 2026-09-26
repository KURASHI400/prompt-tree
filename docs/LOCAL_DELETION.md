# iPhoneでの削除

既存のホーム画面アイコンからオンラインで起動し、「新しいバージョンがあります」が表示されたら「更新」を押してください。アプリの削除・再インストールやサイトデータの消去は不要です。

- Card Detail右上の「…」→「カードを削除」。Rootでは「シリーズを削除」と表示します。
- HOMEの画像右上の「…」→「シリーズを削除」。画像本体のタップはDetail、長押しは従来の並び替えです。
- 編集画面の最下部のDanger Zoneからも同じ確認画面を開けます。

シリーズの確認画面にはCard数と画像数を表示します。確認後に削除され、画面下部の「元に戻す」で10秒間取り消せます。Child Cardを削除しても、その子Card自体は残り、削除Cardへの接続線が解除されます。

Originalとサムネイルは猶予中に保持します。10秒後に端末内で後片付けし、アプリを閉じた場合は次回の起動・PIN解除後に再開します。ファイル削除に失敗した場合はキューを保持して再試行します。画像を保存中のCardは、保存完了後に削除できます。

削除・復元・後片付けはすべてIndexedDB / OPFSで完結します。Cloudflare・外部API・ユーザーデータのアップロードは使用しません。

## 開発者向け検証

- `tests/deletion.test.ts`: 子Card/Series削除とUndo、複数画像、親/参照接続、子Card保持、Gallery/Searchの参照、再読み込み、期限後のファイル/メタデータ削除、失敗時の再試行、workspace分離、画像保存との競合、primary parentの一意性。
- `e2e/deletion.spec.ts`: iPhoneサイズのChromium/WebKitで各UI導線・確認取消・10秒Undo・TREE viewport・Gallery/Search・オフライン・再読み込み・Original/Thumbnailの実ファイル削除を検証。390×844、844×390、320×568で確認Dialogの境界を検証。
- 既存のE2EでHOMEの並び替え、TREE操作、Backup/Restore、PIN、静的サブパス配信を引き続き検証します。

ブラウザの自動検証は実機iPhoneの確認を代替しません。この削除UIの更新をCodex自身が実機iPhoneで確認したものではありません。
