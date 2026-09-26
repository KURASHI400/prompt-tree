# ============================================================
# PROMPT TREE
# 完全ローカル・iPhone Offline-first版
# PRODUCT / IMPLEMENTATION MASTER SPECIFICATION
# Version 4.0
# ============================================================

> このv4は、Cloudflare D1 / R2 / Workersを前提にしたv3および、その後追加された招待制Multi-account仕様を**全面的に置き換える新しい唯一のマスター仕様**です。  
> v4では、ユーザーのPrompt・画像・Tree・メモ等の研究データをCloudへ保存しません。  
> **ユーザーデータは原則としてiPhone内だけに保存します。**

---

# 0. PRODUCT DIRECTION

Prompt Treeは、iPhoneで画像生成研究を整理するためのOffline-first PWAです。

本アプリは画像生成AIそのものではありません。

ユーザーはChatGPT等で生成した画像をPrompt Treeへ取り込み、

- 元Prompt
- 追加・変更Prompt
- 生成画像
- 派生関係
- 比較関係
- メモ
- Rating
- Tags
- AI / Model

とともに保存します。

最重要体験は、

```text
HOME
↓
A-000
↓
TREE
↓
A-001 / A-002 / A-003...
↓
Card Detail
↓
Back
↓
元のTREE位置
```

です。

---

# 1. LOCAL-ONLYの定義

v4で「完全ローカル」とは、次を意味します。

1. PromptデータをServerへ保存しない
2. Card metadataをServerへ保存しない
3. Original画像をServerへuploadしない
4. ThumbnailをServerへuploadしない
5. Tree座標をServerへ保存しない
6. Search queryをServerへ送らない
7. Login serverを持たない
8. D1を使わない
9. R2を使わない
10. Workers APIを使わない
11. Onlineでなくても全CRUD操作可能
12. Internet断でもアプリを起動可能
13. Internet断でも画像追加・Card編集・Tree編集可能

ただしPWAはWeb技術であるため、**最初のインストール元として安定したHTTPS Originは必要**です。

HTTPS Hostはアプリ本体のHTML/CSS/JSを配布するだけです。

ユーザーデータを受信するBackendではありません。

一度PWAがInstallされService WorkerへApp ShellがCacheされれば、Offline起動できます。

---

# 2. CLOUD BILLING POLICY

v4実装では以下を禁止します。

- Cloudflare R2 activation
- Cloudflare R2 bucket create
- Cloudflare D1利用
- Cloudflare Worker production deploy
- Paid hosting service activation
- Credit card / billing setupを必要とする処理
- OpenAI API等の課金API

静的HTTPS Hostingが必要な場合も、Backend serviceは作りません。

Hosting providerの選択はユーザーが後で行えるよう、Build outputをpure staticにしてください。

---

# 3. CURRENT PROJECT REUSE POLICY

v4は全面作り直しではありません。

以下は既存コードを最大限再利用してください。

- React UI
- Router
- HOME
- TREE
- Gallery
- Detail
- Editor
- PhotoSwipe Viewer
- dnd-kit reorder
- React Flow
- Virtualized Grid
- HEIC thumbnail logic
- Domain utilities
- Undo/Redo
- Styles
- PWA update UI
- i18n

Backend依存部分のみ段階的に差し替えます。

---

# 4. TARGET

最優先:

**iPhone Home Screen PWA**

次:

- iPhone Safari
- iPad
- Windows browser

最重要viewport:

iPhone Portrait。

TREEのみLandscape対応。

---

# 5. REQUIRED FRONTEND STACK

基本は既存を維持。

- React
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

Cloudflare依存は削除。

最終`package.json`から原則削除:

- `wrangler`
- `@cloudflare/workers-types`

---

# 6. LOCAL STORAGE ARCHITECTURE

Metadata:

**IndexedDB**

Large image files:

**OPFS (Origin Private File System)**

App Shell:

**Service Worker Cache**

Transient UI:

- React state
- Zustand等
- sessionStorage

---

# 7. WHY INDEXEDDB + OPFS

IndexedDBは以下に向いています。

- Card
- Series
- Edges
- Tags
- Settings
- Search metadata
- PIN verifier
- Drafts

OPFSは以下に向いています。

- Original image
- Thumbnail

OriginalをIndexedDB metadata recordへ巨大Blobとして大量に詰め込むことをPrimary設計にしないでください。

---

# 8. STORAGE CAPABILITY LAYER

Local file accessは直接Componentへ散在させない。

必ずinterface化。

例:

```ts
export interface LocalFileStore {
  writeOriginal(input: WriteImageInput): Promise<StoredFile>;
  writeThumbnail(input: WriteImageInput): Promise<StoredFile>;
  getOriginal(imageId: string): Promise<File | Blob>;
  getThumbnail(imageId: string): Promise<File | Blob>;
  removeImageFiles(imageId: string): Promise<void>;
  exists(imageId: string): Promise<boolean>;
}
```

Primary implementation:

`OpfsFileStore`

Fallback:

`IndexedDbBlobFileStore`

FallbackはOPFS非対応時のみ。

二重保存禁止。

---

# 9. OPFS DIRECTORY STRUCTURE

Display IDをpathへ使わない。

例:

```text
prompt-tree/
  workspaces/
    {workspaceUuid}/
      cards/
        {cardUuid}/
          images/
            {imageUuid}/
              original
              thumbnail.webp
```

Original extensionをpathへ含めなくてもよい。

Filename / MIMEはIndexedDB metadataへ保持。

---

# 10. OPFS WRITE STRATEGY

Runtime capability detectionを行う。

利用可能ならasync writable APIを使用。

必要な環境ではDedicated Worker + SyncAccessHandleも利用可。

どの方式でも:

1. partial writeを検出
2. failure時にready metadataを作らない
3. file sizeを確認
4. close/flushを確実に行う
5. exceptionを握りつぶさない

OPFSが利用できないブラウザではFallback Store。

---

# 11. ACTIVE WORKSPACE MODEL

安全なRestoreのため、Single userでも`workspace_id`概念を持つ。

Control Store:

```text
active_workspace_id
```

全研究データ:

- Series
- Cards
- Images
- Edges
- Tags
- CardTags

は`workspace_id`所属。

通常は1 workspaceだけがActive。

ユーザーUIへWorkspace管理機能を出す必要はありません。

これはRestoreを原子的に切替える内部設計です。

---

# 12. INDEXEDDB DATABASE

推奨DB:

```text
prompt-tree-local
```

Versioned upgradeを実装。

Object Stores例:

```text
control
security
settings
series
cards
images
edges
tags
cardTags
drafts
searchMeta
cleanupQueue
```

必要ならStoreを追加可。

---

# 13. CONTROL STORE

最低:

```ts
{
  key: "active_workspace_id",
  value: string
}
```

その他:

- schema_version
- last_backup_at
- last_backup_revision
- created_at

---

# 14. SERIES RECORD

例:

```ts
interface LocalSeries {
  id: string;
  workspace_id: string;
  root_card_id: string;
  sort_order: number;
  next_card_number: number;

  viewport_x: number;
  viewport_y: number;
  viewport_zoom: number;

  created_at: number;
  updated_at: number;
}
```

---

# 15. CARD RECORD

```ts
interface LocalCard {
  id: string;
  workspace_id: string;
  series_id: string;

  display_id: string;
  display_id_normalized: string;

  title: string;

  prompt_full: string;
  prompt_delta: string;
  memo: string;

  ai_provider: string;
  model: string;

  rating: number | null;
  metadata_json: string;

  cover_image_id: string | null;

  canvas_x: number;
  canvas_y: number;

  auto_number: number | null;

  created_at: number;
  updated_at: number;

  deleted_at: number | null;
}
```

Server conflict用`version`を残してもよいですが、v4ではMulti-device conflict用途ではありません。

---

# 16. IMAGE RECORD

```ts
interface LocalCardImage {
  id: string;
  workspace_id: string;
  card_id: string;
  series_id: string;

  original_filename: string;
  mime_type: string;
  file_size: number;

  width: number;
  height: number;

  sort_order: number;
  is_favorite: boolean;

  storage_backend: "opfs" | "idb";
  original_path: string;
  thumbnail_path: string | null;

  status: "pending" | "ready" | "failed";

  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}
```

Cloud R2 keyは廃止。

---

# 17. EDGE RECORD

```ts
interface LocalEdge {
  id: string;
  workspace_id: string;
  series_id: string;

  source_card_id: string;
  target_card_id: string;

  kind: "parent" | "reference";
  is_primary: boolean;
  color: string;

  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}
```

Parent cycle禁止。

Primary Parent最大1。

Reference cycle可。

---

# 18. ID RULES

v3の仕様を維持。

Series default:

```text
A-000
B-000
...
Z-000
AA-000
AB-000
```

Child:

```text
A-001
A-002
```

任意ID可。

IDとTitleは別。

Title空ならIDだけ。

Display ID normalize:

- trim
- NFKC
- case fold

Active workspace内でunique。

---

# 19. ROOT MODEL

Series = container。

Root Card = actual experiment。

Rootには:

- image
- prompt
- memo
- rating
- tags

を持てる。

SeriesへPrompt/Imageを二重保存しない。

---

# 20. HOME

既存UIを維持。

Root CardだけGrid表示。

表示:

- Cover Thumbnail
- ID
- optional Title

Prompt非表示。

iPhone約2列。

長押しDragでSeries reorder。

OrderはIndexedDBへ即保存。

---

# 21. CREATE SERIES

`＋`

入力:

- ID
- Title
- Images
- Full Prompt
- Memo

画像最低1枚。

複数画像可。

Create手順:

1. workspace確認
2. ID unique check
3. Series draft
4. Root Card draft
5. Local image writes
6. thumbnail
7. metadata transaction
8. ready
9. HOME更新

全画像uploadではなくLocal write。

---

# 22. CARD = GENERATION EXPERIMENT

絶対条件。

A-005に同じPromptで5枚生成:

```text
A-005
 ├ image 1
 ├ image 2
 ├ image 3
 ├ image 4
 └ image 5
```

TREE:

1 Card。

IMAGES:

5 images。

---

# 23. CARD DETAIL

Header:

```text
← 戻る                         ツリーへ →
```

表示:

- ID
- Title
- Carousel
- Rating
- Full Prompt
- Delta Prompt
- Memo
- AI Provider
- Model
- Tags
- Advanced Metadata
- Relations

Prompt:

3〜5行preview。

続きを見る。

Copy。

---

# 24. BACK BEHAVIOR

既存v3要件を維持。

TREE → Detail → Back:

元Canvas exact state。

IMAGES → Viewer/Detail → Back:

元Grid scroll/filter。

SEARCH → Detail → Back:

query + scroll。

Overlay routingを維持。

---

# 25. IMAGE ADD

Online状態を一切要求しない。

Photos/Filesから選択。

即Local processing。

Flow:

```text
File choose
↓
validate
↓
storage capacity pre-check
↓
thumbnail
↓
Original local write
↓
Thumbnail local write
↓
metadata commit
```

---

# 26. ORIGINAL IMAGE

原本を勝手に再圧縮しない。

PNGならPNG original bytes。

JPEGならJPEG original bytes。

HEICならHEIC original bytes。

ThumbnailだけWebP変換可。

---

# 27. OBJECT URL MANAGEMENT

OPFS/IndexedDB Blobから表示するため、Object URLを利用可。

ただし大量Blob URLを永続生成しない。

LRU cache。

不要になったObject URLはrevoke。

ThumbnailはGrid viewport周辺だけ。

---

# 28. IMAGE VIEWER

PhotoSwipeを維持。

OriginalはLocal FileStoreから読む。

`fetch(/api/...)`禁止。

左右Swipe / Pinch / Pan。

写真に保存:

Web Share APIまたはDownload fallback。

Prompt Copy。

Card Detail。

Tree focus。

---

# 29. TREE

既存React Flow UIを最大限維持。

- infinite canvas
- one-finger pan
- pinch zoom
- card tap
- long press move
- multi-parent
- primary
- reference
- edge color
- independent node
- undo/redo
- root
- fit view

Backend APIだけ置換。

---

# 30. TREE NO PAGE SCROLL

絶対条件継続。

TREE中:

```text
document.body.scrollTop = 0
document.documentElement.scrollTop = 0
```

を維持。

Canvasだけ動く。

実機iPhone検証必須。

---

# 31. TREE VIEWPORT

Series recordへlocal save。

Debounce。

DetailをOverlayで開き、Back時はLocal session snapshot優先。

Server sync不要。

---

# 32. MULTI-PARENT

複数Parent。

Primary最大1。

Parent cycle禁止。

Reference cycle可。

Local Repository内でもvalidation。

---

# 33. GALLERY / IMAGES

現行Galleryを維持。

写真アプリ風。

3列前後。

Square crop。

Filters:

- All
- Series
- Root
- Derived
- Favorite

Sort:

- Newest
- Oldest
- Series

10,000 images virtualization。

---

# 34. GALLERY DATA QUERY

Server paginationではなくIndexedDB cursor/query。

画面へ必要なmetadataだけ返す。

一度に10,000全件をReact stateへ積まない。

Local pagination/cursor abstractionを実装。

---

# 35. SEARCH

Server FTSは廃止。

Local search service。

Search対象:

- Display ID
- Title
- Full Prompt
- Delta Prompt
- Memo
- AI
- Model
- Tags

第一実装はDedicated Workerによるmetadata searchでもよい。

目標:

数千Cardsで体感的に十分速いこと。

Main threadを長時間blockしない。

必要ならpersisted local search indexを導入。

---

# 36. LOCAL REPOSITORY

ComponentがSQL/IndexedDB storeへ直接触らない。

Typed repositories。

例:

```ts
seriesRepository.list()
seriesRepository.create()
seriesRepository.reorder()

cardRepository.get()
cardRepository.create()
cardRepository.update()
cardRepository.move()

treeRepository.get()
treeRepository.saveViewport()

imageRepository.list()
imageRepository.favorite()

searchRepository.search()
settingsRepository.get()
```

---

# 37. NO FAKE REST API

移行途中に既存`api("/cards/...")`をLocal adapterへ繋ぐことは一時的に許可。

しかし完成版ではURL文字列を解析する巨大なFake REST Routerを主要設計として残さない。

Typed serviceへ段階的に置換。

---

# 38. OFFLINE-FIRST

v4ではOfflineが例外ではありません。

`navigator.onLine === false`でも:

- Series create
- Card create
- Image import
- Edit
- Delete
- Tree move
- Search
- Favorite
- Rating
- Backup

すべて使用可能。

Offline bannerは警告として出さなくてよい。

Onlineは主にPWA Update取得にのみ関係する。

---

# 39. SERVICE WORKER

App shellをprecache。

必要なJS/CSS/iconsをOffline起動可能に。

Runtime DataはIndexedDB/OPFS。

API cache不要。

`/api` denylist不要。

Service Worker updateはPrompt方式。

新versionを勝手にactivateして編集中Dataを失わせない。

---

# 40. STATIC HOSTING

Build outputはStatic-only。

`dist/`だけで動く。

Runtime server requirementなし。

GitHub Pages / Cloudflare Pages / その他Static HTTPS Hostに置換可能。

Cloud backend bindingなし。

Static hostがなくてもLocal devでは`vite preview`で動く。

iPhoneへPWAとしてInstallする本番時のみ安定HTTPS originが必要。

---

# 41. ROUTER FOR STATIC HOST

Static hostでDeep Link 404を避けるため、以下いずれか。

推奨:

**HashRouter**

例:

```text
/#/home
/#/series/.../tree
```

またはstatic hostに確実なSPA fallbackがある場合のみBrowserRouter。

Hosting provider非依存性を優先。

---

# 42. NO RUNTIME NETWORK

Production v4ではUser Data操作で`fetch("/api/...")`を呼ばない。

外部API呼び出しなし。

External CDN assetsなし。

Fontもsystem font。

可能であればProduction CSPで`connect-src 'none'`相当を検討。

PWA update / static asset deliveryを壊さない形で適用。

---

# 43. PIN LOCK

Server login廃止。

First launch:

```text
4桁PINを設定
確認
```

PIN verifierはLocal security store。

Web Crypto PBKDF2 + random salt。

Plain PIN保存禁止。

---

# 44. PIN LIMITATION

4桁PINはCryptographic encryptionではない。

UI privacy lock。

iPhone device lockと組み合わせる前提。

アプリ内で「エンドツーエンド暗号化」等と誤表現禁止。

---

# 45. AUTO LOCK

5分無操作。

Background一定時間。

Lock。

App Switcher privacy overlayを維持。

First paintでSensitive UIを先に出さない。

---

# 46. OPTIONAL DEVICE AUTH

WebAuthn / platform authenticatorがLocal-only構成で安定利用できる場合のみ追加。

難しい場合はMVP blockにしない。

有料サービスを導入しない。

PIN fallback必須。

---

# 47. PERSISTENT STORAGE

ローカル版最重要。

First Setup後、ユーザー操作を契機に:

```ts
navigator.storage.persist()
```

を実行。

確認:

```ts
navigator.storage.persisted()
```

Settingsへ状態表示。

Persistent grantを保証しない。

未承認なら明確に警告。

---

# 48. STORAGE ESTIMATE

Settings:

```text
保存使用量
3.2 GB

利用可能目安
42 GB

永続ストレージ
有効
```

`navigator.storage.estimate()`。

Quotaは推定値であり保証容量ではない。

---

# 49. STORAGE PRESSURE

画像保存前にestimate。

十分なheadroomがない場合:

Warning。

`QuotaExceededError`を必ずcatch。

ユーザーへ:

```text
保存容量が不足しています。
バックアップ後、不要な画像を削除してください。
```

途中保存でmetadataだけreadyにならない。

---

# 50. STORAGE THRESHOLD

目安:

- usage/quota 70%: subtle notice
- 85%: warning
- 95%: strong warning / image import blockを検討

ただしQuota値は推定なので絶対値として扱わない。

---

# 51. SETTINGS STORAGE SECTION

必須:

- Persistent Storage status
- usage
- estimated quota
- Original image count
- Card count
- last backup date
- backup status

Never backed upなら目立つ表示。

---

# 52. BACKUP POLICY

Local-only版ではBackupは**必須級機能**。

Settingsに:

```text
バックアップ
最終: 2026/09/24

[完全バックアップを作成]
[バックアップから復元]
```

定期Reminderを実装。

例:

最後のBackupから7日超、または100変更超でSettings/Homeに小通知。

邪魔な毎回Popupは禁止。

---

# 53. BACKUP FORMAT

Versioned format。

例:

```text
PromptTree_Backup_2026-09-24_part001.ptbackup
```

内部ZIP。

Part 1:

```text
manifest.json
data.json
images/...
```

Metadata:

- backup_format_version
- app_version
- backup_id
- created_at
- part_number
- total_parts
- workspace_id_original
- counts
- total_original_bytes

---

# 54. BACKUP DATA

完全Restoreに必要な研究データを全て含める。

- Series
- Cards
- Card Images metadata
- Edges
- Tags
- CardTags
- Tree positions
- Tree viewports
- App research settings
- Original Images

Thumbnailは含めなくてもよい。

Restoreで再生成可能。

PIN verifierは含めない。

---

# 55. BACKUP LARGE DATA

GB級Backupを1巨大Blobにしない。

Part分割。

Part target sizeは設定値。

iPhone memory safety優先。

Streaming ZIPを可能な範囲で使用。

保存はWeb Share / download。

ユーザーがFiles / iCloud Drive等へ移せるようにする。

---

# 56. BACKUP INTEGRITY

各Originalについて可能なら:

- byte size
- SHA-256

をmanifestへ。

Restoreでvalidate。

大容量HashはWorkerで実行。

UI thread block禁止。

---

# 57. RESTORE

Settings:

```text
バックアップから復元
```

複数part選択可。

Restore Flow:

1. files select
2. manifest validate
3. all required parts確認
4. format version確認
5. available storage確認
6. new workspace ID生成
7. metadata stage
8. images stage to new OPFS workspace
9. validate counts / sizes / hashes
10. IndexedDB records commit
11. active_workspace_id切替
12. UI refresh
13. old workspace cleanupは後

---

# 58. RESTORE ATOMICITY

既存データを先に消さない。

Restore途中失敗:

現在workspaceを維持。

成功した時だけactive workspaceをflip。

Restore成功後:

```text
復元しました
```

旧workspaceは一定期間または次起動cleanup。

ユーザーに即消去させない。

---

# 59. RESTORE PIN

BackupにPINは含めない。

Restore後も現在端末PINを継続使用。

新規install直後にRestoreする場合:

先に新PINを設定。

---

# 60. DELETE / UNDO

削除確認。

短時間Undo。

OPFS Originalを即消さない。

metadata deleted_at + cleanup queue。

Undo猶予後にLocal files delete。

30日Trash UI不要。

---

# 61. SEARCH / DELETE / BACKUP TRANSACTIONS

大きな処理は部分失敗を考慮。

IndexedDB transactionで整合。

OPFSとIndexedDBは同一Transactionにできないため、

- pending
- staged
- ready

stateを使う。

---

# 62. LOCAL IMAGE IMPORT ATOMICITY

推奨:

1. image record pending
2. write original
3. generate/write thumbnail
4. verify files
5. metadata transaction
6. ready

Failure:

pending/failed。

Cleanup可能。

Ready Cardへbroken imageを混ぜない。

---

# 63. THUMBNAIL

既存logicを再利用。

HEIC対応。

Thumbnail long edge 512〜768。

GridではSquare cropをCSS。

---

# 64. SEARCH PERFORMANCE TARGET

目標:

数千Cards。

検索typingでUI freezeしない。

Debounce。

Web Worker利用可。

Search queryは端末外へ出さない。

---

# 65. IMAGE PERFORMANCE TARGET

10,000 Image metadata。

- virtual grid
- local cursor
- lazy Object URL
- thumbnail only
- LRU Object URL cache

全Originalを読む禁止。

---

# 66. TREE PERFORMANCE TARGET

数百Nodes。

React Flow rendering最適化。

Tree API fetchがなくなるため、Local indexed reads。

Node Component memo。

---

# 67. ROUTE / CODE SPLITTING

Tree
Viewer
HEIC decoder
Backup/Restore

はlazy load可。

初期bundleを過大化しない。

---

# 68. STATIC PWA SECURITY

ユーザーデータはLocalのみ。

Production runtimeにAnalyticsを追加しない。

External fonts/CDN不要。

Search query/Promptを外部送信禁止。

Crash report serviceもユーザー承認なしで追加しない。

---

# 69. DATA EXPORT

Full Backupとは別に、研究内容を読むための軽量Exportも可。

例:

- Prompt CSV
- Prompt JSON
- selected images

ただしv4ではFull Backup/Restoreが優先。

---

# 70. FIRST RUN UX

初回:

1. Welcome
2. 4-digit PIN設定
3. Local-only説明
4. Persistent Storage request
5. Backup重要性を1画面だけ説明
6. HOME

長いTutorial禁止。

---

# 71. LOCAL-ONLY EXPLANATION

簡潔に:

```text
画像とPromptはこのiPhone内に保存されます。
Cloudへ自動送信しません。

iPhoneの故障やアプリデータ削除に備え、
定期的にバックアップしてください。
```

---

# 72. APP UPDATE

Service Worker:

update available。

ユーザー承認までactivateしない。

更新前にIndexedDB migrationが必要な場合:

backup推奨。

Migrationは後方互換。

---

# 73. INDEXEDDB MIGRATIONS

DB version upgradeは慎重に。

既存dataをclearしない。

Upgrade functionをunit test。

Migration failure時にdata deletion禁止。

---

# 74. EXISTING CLOUD DATA MIGRATION

v4への初回方向転換時、既存Cloud dataを自動fetchしない。

今回のsource docs上ではProduction user dataなしと記録。

もし開発PCのlocal D1/R2 stateに実データが存在する場合のみ、Codexは削除前に検出・報告。

必要なら一度だけLocal Import scriptを作る。

ユーザー確認なしに既存local stateを削除しない。

---

# 75. CURRENT CLOUD RESOURCES

v4はCloudflare resourceを利用しない。

既存Remote D1があってもignore。

Codexは勝手に:

- delete D1
- activate R2
- deploy Worker

しない。

Cloud cleanupは別途ユーザー判断。

---

# 76. PACKAGE SCRIPTS

最終:

```text
dev
build
preview
typecheck
lint
test
test:e2e
```

`wrangler`依存を削除。

`start`が必要なら`vite preview`系。

---

# 77. PLAYWRIGHT

Static appを起動。

API server不要。

例:

```text
vite build
vite preview --host 127.0.0.1 --port 4173
```

Browser contextごとIndexedDB/OPFSをclear可能なtest helper。

---

# 78. TEST DATA

10,000 image metadata synthetic。

実画像10,000枚repoへ入れない。

Small image fixtures。

OPFS tests。

---

# 79. TEST — LOCAL CRUD

Offline browser contextでも:

- create series
- create card
- edit prompt
- add image
- move node
- favorite
- search

が成功。

`navigator.onLine=false`を理由にwrite拒否しない。

---

# 80. TEST — RELOAD PERSISTENCE

Create data。

Page reload。

PWA restart相当。

Expected:

全部残る。

---

# 81. TEST — OPFS

Original bytes write/read。

byte-for-byte一致。

Thumbnail separate。

Original再圧縮なし。

---

# 82. TEST — STORAGE FALLBACK

OPFS capabilityをmock unavailable。

IndexedDB Blob fallbackが機能。

---

# 83. TEST — PERSISTENCE UI

`persisted()` true / false / unsupportedをmock。

UIが正しい。

---

# 84. TEST — QUOTA ERROR

`QuotaExceededError` simulation。

Metadata corruptionなし。

User message。

---

# 85. TEST — BACKUP / RESTORE

Dataset:

- 3 Series
- multiple Cards
- multi-images
- multi-parent
- reference
- tags
- viewports

Backup。

別workspaceへRestore。

Expected:

- counts match
- original hashes match
- tree coordinates match
- edges match
- prompts match
- active workspace switch

---

# 86. TEST — FAILED RESTORE

Restore mid-way failure。

Expected:

existing active workspace unchanged。

---

# 87. TEST — PIN

- first setup
- wrong PIN
- backoff
- correct PIN
- 5min lock
- visibility privacy
- reload lock

Server login testは削除。

---

# 88. TEST — TREE

v3受入を継続。

- body scroll 0
- pan
- pinch
- long press move
- exact back
- orientation
- parent cycle
- undo

---

# 89. TEST — GALLERY

- 10k metadata
- DOM virtualization
- filter
- sort
- favorite
- viewer
- scroll restore
- original local read

---

# 90. IPHONE PHYSICAL ACCEPTANCE

必須。

- PWA install
- airplane mode起動
- airplane modeでSeries/Card create
- Photosから5枚 import
- Original保持
- HEIC
- Tree pan/pinch
- node long press
- body no-scroll
- Detail back exact
- image grid
- viewer
- persistent storage status
- storage estimate
- backup to Files
- restore
- background privacy
- 5min PIN lock
- dark mode
- landscape Tree

Playwright WebKitだけで実機完了扱い禁止。

---

# 91. CRITICAL ACCEPTANCE

1. Cloudflare runtime dependency 0
2. D1 runtime dependency 0
3. R2 runtime dependency 0
4. Worker API runtime dependency 0
5. Offlineで全CRUD可能
6. Original local-only
7. Card metadata local-only
8. 1 Card multiple images
9. TREE one node
10. Gallery each image cell
11. exact viewport restore
12. body scroll 0 in TREE
13. Persistent Storage request/status
14. Storage estimate UI
15. Full Backup
16. Full Restore
17. failed Restore leaves old data intact
18. PIN lock
19. 5min auto lock
20. static PWA build
21. no card/billing requirement
22. iPhone physical acceptance pending until real device test

---

# 92. DO NOT DO

禁止:

- R2 activate
- Worker deploy
- D1 write
- fake API local routerを完成形にする
- Online-only edit
- OriginalをBase64 textへ大量保存
- LocalStorageへ画像保存
- 1 image 1 cardへ変更
- Tree UI作り直し
- HomeをInfinite Canvas化
- User dataをAnalyticsへ送信
- CDNへOriginal upload
- BackupなしでLocal-only完成扱い
- Restore失敗時に既存data消去

---

# 93. FINAL SUCCESS DEFINITION

ユーザーが飛行機モードのiPhoneでPrompt Treeをホーム画面から起動し、

1. PIN解除
2. A-000を作成
3. 写真を追加
4. Promptを書く
5. Treeへ移動
6. A-001を派生作成
7. 線で接続
8. さらに画像を追加
9. Card Detailを開く
10. Backして同じTree位置へ戻る
11. Imagesで全画像を見る
12. Searchする
13. 完全BackupをFilesへ保存
14. Backupから別workspaceへ完全Restore

まで、**一度もServer APIを必要とせず実行できること**。

これをv4の完成条件とします。

---

# 94. TECHNICAL BASIS

v4のローカルStorage前提は、WebKit / Web標準の以下の機能を利用します。

- Origin Private File System
- IndexedDB
- StorageManager.persist()
- StorageManager.persisted()
- StorageManager.estimate()
- Service Worker / PWA

OPFSはOrigin privateで、ユーザーが通常のFilesアプリから直接見える領域ではありません。  
そのため、Full Backup / Restoreは必須機能として扱います。

---

# ============================================================
# === END OF PROMPT TREE MASTER SPECIFICATION v4.0 ===
# ============================================================
