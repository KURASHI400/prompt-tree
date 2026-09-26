> DEPRECATED — DO NOT FOLLOW FOR v4
> 旧クラウド版の履歴資料です。現行仕様は ../PROMPT_TREE_MASTER_SPEC_v4_LOCAL_OFFLINE.md です。

# Prompt Tree 現行ソース監査レポート
## 2026-09-24 / 完全ローカル・iPhone Offline版への方向転換前監査

> 対象: `PromptTree-source.zip`  
> 監査目的: 現在のCloudflare前提実装から、ユーザーデータをiPhone内だけに保存するOffline-first PWAへ安全に方向転換できるかを判断する。

---

## 1. 結論

**方向転換は可能です。しかも現状コードのかなりの部分を再利用できます。**

現行実装は、UI・カードモデル・TREE・画像一覧・Viewer・PWA・iPhone向けCSS・テスト骨格がすでにかなり出来ています。  
一方で、現在のデータアクセス、認証、画像保存、検索、ExportはCloudflare Workers / D1 / R2を中心に構築されているため、そこを**ローカルストレージ層へ置換**する必要があります。

全部作り直す必要はありません。

方向転換後の大枠は次のとおりです。

```text
現状
React UI
  ↓
/api
  ↓
Cloudflare Worker
  ├─ D1
  └─ R2

変更後
React UI
  ↓
Local Repository / Local Services
  ├─ IndexedDB
  └─ OPFS
```

重要なのは、UIを壊して作り直すのではなく、**データ層と認証層を差し替える**ことです。

---

## 2. 現在の主要構成

`package.json`上の主な依存は以下です。

### 再利用価値が高い

- React 19
- TypeScript
- Vite
- React Router
- `@xyflow/react`
- `@dnd-kit/*`
- `@tanstack/react-virtual`
- `photoswipe`
- `heic2any`
- `idb`
- `fflate`
- `vite-plugin-pwa`
- Vitest
- Playwright

これらは完全ローカル版でもそのまま活用できます。

### Cloudflare依存

- `wrangler`
- `@cloudflare/workers-types`
- `worker/*`
- `migrations/*`
- `wrangler.jsonc`
- `wrangler.production.jsonc`
- `.dev.vars.example`
- Cloudflare Worker起動用scripts
- D1 / R2前提E2E

これらは最終的なv4では不要になります。

---

## 3. 現行コードで強く再利用すべきもの

### `src/Home.tsx`

HOMEの2列系Grid、Series card、長押し並べ替えの考え方はそのまま利用できます。

変更点は、`api()`呼び出しをLocal Repositoryへ置き換えることが中心です。

### `src/Tree.tsx`

約600行あり、React Flowを使ったTREEの中核です。

現行仕様ですでに、

- SeriesごとのCanvas
- node表示
- viewport
- long press系操作
- Edge
- Undo/Redo
- focus
- fit view

などが実装されています。

**ここは捨てないでください。**

Cloud API部分だけをローカルRepository呼び出しへ切り替えるのが最優先です。

### `src/Gallery.tsx`

すでに、

- 仮想化
- Series filter
- Root/Child/Favorite filter
- sort
- multi-select
- Viewer
- 3/4/6列系のレスポンシブ

が実装されています。

これもv4の「写真アプリ風画像一覧」のベースとして非常に価値があります。

### `src/Detail.tsx`

Root / Child DetailのUIと関係表示を再利用できます。

### `src/Editor.tsx`

Card作成・編集FormのUIを再利用できます。

ただし現行コードにはOnline限定判定があるため、v4では削除し、**Offlineでも完全編集可能**にします。

### `src/Viewer.tsx`

PhotoSwipeベースなので再利用価値が高いです。

現在はOriginalを`fetch(/api/images/...)`しているため、OPFSからBlob/Object URLを得る実装へ置換します。

### `src/ImageControls.tsx`

Image reorder / favorite / cover / replace等のUIは再利用できます。

### `src/domain.ts`

- normalize
- seriesLabel
- childId
- wouldCycle
- placement

はクラウド非依存です。

基本的に残してください。

### `src/history.ts`

Undo / Redoはクラウド非依存です。

局所調整だけで利用可能です。

### `src/style.css`

iPhone Safe Area、TREE no-scroll、Gallery、Detail等の多くがすでに実装済みです。

全面書き直し禁止。

---

## 4. 大きく書き換える必要があるファイル

### `src/api.ts`

現状の中心的Cloud API clientです。

- `/api`
- `fetch`
- account headers
- offline時write禁止
- server lock
- server error handling

が入っています。

v4ではこの設計を廃止します。

最終状態では、画面からREST風文字列パスを投げるのではなく、typed local servicesを使用してください。

例:

```ts
seriesRepository.list()
cardRepository.get(cardId)
treeRepository.get(seriesId)
imageRepository.list(query)
```

一時的なcompatibility adapterは移行中のみ可ですが、完成版に巨大なfake API routerを残さないでください。

### `src/useData.ts`

現在は`path: string`を`api()`へ渡します。

Local loader function / typed hooksへ変更します。

### `src/cache.ts`

現状はServer Response cache + Offline PIN verifierです。

`idb`利用実績があるため一部ロジックは参考になりますが、v4ではCacheではなく**Primary Local Database**が必要です。

既存`prompt-tree-cache`を本番データDBとして無理に拡張するより、

```text
prompt-tree-local
```

等の新しいIndexedDBを作ることを推奨します。

### `src/images.ts`

現在はCloud upload / `/api/images/...` URLを前提にしています。

以下へ書き換えます。

- OPFS Original write
- OPFS Thumbnail write
- local object URL
- capability detection
- quota handling
- write failure recovery

### `src/export.ts`

現在はServer `/api/export/*`を利用しています。

v4では完全クライアントサイドのBackup/Restoreへ作り替えます。

### `src/AuthGate.tsx`

現行は、

- Server auth
- invited accounts
- Master Password
- session
- offline PIN cache

を扱います。

v4ではSingle Local Userです。

残す価値があるもの:

- 5分Auto Lock
- visibility privacy overlay
- activity tracking
- PIN UIの一部

削除するもの:

- account switching
- login
- register
- invitation
- server session
- master password requirement

### `src/Settings.tsx`

Cloud account / invitation関連を削除し、

- Persistent Storage
- Storage usage/quota
- Full Backup
- Restore
- PIN change
- App version
- Local data reset

へ変更します。

---

## 5. 削除候補

完成版v4では以下を原則削除します。

```text
worker/
migrations/
wrangler.jsonc
wrangler.production.jsonc
.dev.vars.example
src/Invitations.tsx
scripts/recover-owner.mjs
scripts/start-local.mjs
scripts/prepare-e2e.mjs
```

`seed-performance.mjs`はLocal IndexedDB/OPFS用へ書き換えるなら残して構いません。

`scripts/check.ps1`はWrangler dry-runを削除してLocal build/test専用へ変更してください。

---

## 6. 現行テストについて

現行ソースには多数のE2Eがありますが、その多くは`page.request.get("/api/...")`のようにServer APIへ直接アクセスします。

したがってv4ではそのまま使えません。

ただし、**テストシナリオの意図は極めて価値があります。**

残すべき受入内容:

- 1 Card / 5 images
- Tree exact viewport restore
- document/body scroll=0
- Home reorder persistence
- Multiple parents
- Parent cycle reject
- Gallery virtualization
- Search state restore
- Upload partial failure
- Original integrity
- Offline lock
- Dark mode / WebKit

E2EはUI経由、またはBrowser内Local Repository helper経由へ変更してください。

---

## 7. 現在のCloudflare状態

ソース内の`README.md`、`docs/IMPLEMENTATION_STATUS.md`、`docs/DEPLOYMENT_STATUS.md`によると、作成時点では次の状態でした。

- Cloudflare OAuth認証済み
- Remote D1 `prompt-tree` 作成済み
- Migration 0001〜0007適用済み
- Remote users count = 0 と記録
- R2 bucketはまだ作成されていない
- R2 subscription checkout途中
- Production Workerは未deploy
- Public app URLはまだない
- Local/E2E dataをRemoteへuploadしていないと記録

これは**ソース内ドキュメントに記録された状態**であり、この監査ではCloudflareアカウントへ再接続して現状照合はしていません。

v4移行では、

**R2を有効化しないこと。Production Workerをdeployしないこと。**

を明示的な安全条件にしてください。

既に存在するRemote D1はアプリv4から利用しません。

Codexが勝手にRemote D1を削除することも禁止します。  
削除するかどうかは、v4完成後にユーザー本人が別途判断してください。

---

## 8. v4で新規に追加する主要モジュール

推奨構成:

```text
src/local/
  db.ts
  schema.ts
  repository/
    series.ts
    cards.ts
    images.ts
    tree.ts
    search.ts
    settings.ts

  files/
    opfs.ts
    fileStore.ts
    objectUrlCache.ts
    thumbnail.ts

  security/
    pin.ts
    lock.ts

  storage/
    quota.ts
    persistence.ts

  backup/
    format.ts
    createBackup.ts
    restoreBackup.ts
    validateBackup.ts
```

名称は多少変更可。

---

## 9. IndexedDBへ保存するもの

- Series
- Cards
- CardImages metadata
- Edges
- Tags
- CardTags
- Settings
- PIN verifier
- Drafts
- backup metadata
- active workspace pointer

大きなOriginal画像本体は原則OPFS。

---

## 10. OPFSへ保存するもの

推奨:

```text
prompt-tree/
  workspaces/
    {workspaceUuid}/
      cards/
        {cardUuid}/
          {imageUuid}/
            original
            thumbnail.webp
```

Display IDやTitleをpathへ使わない。

Renameしてもfile move不要。

---

## 11. OPFS fallback

iOS/WebKit互換性のためStorage layerはinterface化。

```ts
interface LocalFileStore {
  writeOriginal(...)
  writeThumbnail(...)
  readOriginal(...)
  readThumbnail(...)
  deleteImage(...)
  estimate(...)
}
```

Primary:

OPFS。

OPFS書き込みAPIが利用できない場合のみIndexedDB Blob storeへfallback可能。

ただし同じ画像をOPFSとIndexedDBの両方へ二重保存しない。

---

## 12. Persistent Storage

ローカル運用ではここが最重要です。

初期設定後、ユーザー操作を契機に:

```ts
navigator.storage.persist()
```

を要求。

Settingsに以下を表示:

```text
永続ストレージ: 有効 / 未承認 / 非対応
使用量: xx GB
利用可能目安: xx GB
```

`navigator.storage.estimate()`を使う。

Storage quotaは保証値ではないため、`QuotaExceededError`を必ず処理。

---

## 13. Backup / Restore

Cloud backupがなくなるため、v4ではBackupは補助機能ではなく**必須機能**です。

Full Backupには最低限:

- All Series
- Cards
- Edges
- Tags
- Tree positions
- Viewports
- Settings（研究設定のみ）
- All Original Images
- versioned manifest

を含める。

PIN verifierは含めない。

Restore後も現在端末のPINを使用。

ThumbnailはBackup省略可。Restore後に再生成。

---

## 14. 完全Restoreの安全性

Restore中に既存データを先に消さない。

推奨:

- `workspace_id`を全レコードに持たせる
- Restoreは新しいworkspace IDへstage
- OPFSも新workspace folderへ書く
- 全validation成功後に`active_workspace_id`を切替
- 旧workspaceは一定時間残し、後からcleanup

これによりRestore途中失敗でも既存データを保持できる。

---

## 15. Static PWA

Runtime backendは不要です。

PWA本体はHTTPSから最初に読み込む必要がありますが、**ユーザーデータは一切Serverへ送らない**設計にします。

一度Install/Cache後はOffline起動可能。

Static hosting providerは交換可能にしてください。

本番Data APIを持たないこと。

---

## 16. 最終判断

### そのまま残す価値が高い

- UI全般
- React Flow TREE
- Gallery virtualization
- PhotoSwipe
- dnd-kit
- PWA更新通知
- iPhone CSS
- Domain utility
- Undo history
- Image thumbnail生成ロジックの一部

### 差し替える

- API
- Data repository
- Image read/write
- Auth
- Search backend
- Export
- Offline policy

### 削除する

- Workers
- D1 migrations
- R2 bindings
- Invitations
- Wrangler production path

したがって、現時点は「失敗して最初から作り直す状態」ではありません。

**UI資産を残したまま、Cloud backendをLocal storage engineへ交換するのが正しい移行です。**
