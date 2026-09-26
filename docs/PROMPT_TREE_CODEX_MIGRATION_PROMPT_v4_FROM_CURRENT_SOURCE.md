# ============================================================
# PROMPT TREE
# CODEX MIGRATION MASTER PROMPT
# Current Cloudflare Build -> v4 Local Offline-first PWA
# 2026-09-24
# ============================================================

あなたは既存Prompt Treeソースを監査・修正するLead Engineerです。

この作業は新規アプリをゼロから作る作業ではありません。

**既存UI・TREE・Gallery・Detail・Viewer・Domain logicを最大限温存しながら、Cloudflare backendだけを完全ローカルStorageへ置換するMigrationです。**

必ず以下の新マスター仕様を最優先で読んでください。

```text
docs/PROMPT_TREE_MASTER_SPEC_v4_LOCAL_OFFLINE.md
```

旧v3および招待制Cloud版仕様はHistorical Referenceです。

v4と衝突する場合、**v4を優先**してください。

---

# 0. 最重要安全指示

このMigrationでは、以下を絶対に実行しないでください。

- R2 subscriptionを有効化しない
- R2 bucketを作らない
- Production Workerをdeployしない
- Remote D1へwriteしない
- Remote D1を削除しない
- Cloudflare billing設定を変更しない
- Credit card情報を要求しない
- 有料serviceを追加しない
- OpenAI API等を追加しない

現行source docsではRemote D1作成済み、R2未作成、Production Worker未deployと記録されています。

Remote resourcesのcleanupはこのMigrationのScope外です。

**Cloudflareへ触らず、Local sourceだけを変更してください。**

---

# 1. 現行ソース監査済み情報

対象Sourceには以下があります。

## 再利用すべきFrontend

```text
src/App.tsx
src/Home.tsx
src/Tree.tsx
src/Gallery.tsx
src/Detail.tsx
src/Editor.tsx
src/Viewer.tsx
src/ImageControls.tsx
src/PwaStatus.tsx
src/domain.ts
src/history.ts
src/style.css
src/i18n/
src/types.ts
```

主要Libraries:

- React
- TypeScript
- Vite
- React Router
- @xyflow/react
- dnd-kit
- TanStack Virtual
- PhotoSwipe
- HEIC converter
- idb
- fflate
- vite-plugin-pwa

これらを捨てないでください。

---

# 2. 現在Cloud依存が強い箇所

大幅Rewrite対象:

```text
src/api.ts
src/cache.ts
src/useData.ts
src/images.ts
src/export.ts
src/AuthGate.tsx
src/Settings.tsx
src/PendingUploads.tsx
```

削除対象:

```text
src/Invitations.tsx
worker/*
migrations/*
wrangler.jsonc
wrangler.production.jsonc
.dev.vars.example
scripts/recover-owner.mjs
scripts/prepare-e2e.mjs
```

`start-local.mjs`もWrangler専用なら削除。

`scripts/check.ps1`はLocal test用へRewrite。

---

# 3. 作業開始前

最初に現在のrepositoryを確認してください。

もしGit repositoryなら:

1. `git status`
2. 未commit変更確認
3. ユーザー変更を消さない

可能なら現在状態を安全なcheckpoint commit/tagへ保存。

例:

```text
pre-v4-local-migration
```

ただしユーザーのGit historyを勝手にrewindしない。

ZIP等からGitなしの場合は、新規`git init`してもよいが、既存Gitがある場合は壊さない。

---

# 4. Local Cloud State Safety Check

削除作業前に、作業directoryの以下を確認。

```text
.wrangler/state
work/
```

もしlocal D1/R2 stateにUser dataが存在する可能性がある場合:

**削除しない。**

件数を調査し、実データがあるならMigrationを止めず、まずBackup/export手段を作る。

Source docsではnormal data count 0と記録されているが、現在のworking directoryを実測して確認。

Remote Cloudflareへ問い合わせる必要はない。

---

# 5. 目標Architecture

最終:

```text
React Components
   ↓
Typed Local Repositories
   ├─ IndexedDB
   └─ LocalFileStore
        ├─ OPFS
        └─ IndexedDB Blob fallback

PWA Service Worker
   └─ app shell cache
```

禁止:

```text
React
 ↓
fake /api string parser
 ↓
IndexedDB
```

一時adapterはMigration途中のみ。

---

# 6. Phase A — Cloud Freeze

最初にCloud関連を「実行不能」にしてください。

1. Production deploy scriptを削除/無効化
2. Buildから`wrangler deploy --dry-run`を外す
3. `npm run deploy`を削除
4. Worker起動をdev/test pathから外す
5. Playwright webServerをVite previewへ変更

ただしまだworker directoryを消す前にLocal replacementが動くところまで進めてもよい。

Goal:

**Codexが誤ってCloudflareへdeployできない状態を先に作る。**

---

# 7. Phase B — New Local Modules

以下を新設してください。

```text
src/local/
  db.ts
  schema.ts

  repository/
    seriesRepository.ts
    cardRepository.ts
    imageRepository.ts
    treeRepository.ts
    searchRepository.ts
    settingsRepository.ts

  files/
    LocalFileStore.ts
    OpfsFileStore.ts
    IndexedDbBlobFileStore.ts
    objectUrlCache.ts

  security/
    pin.ts
    lock.ts

  storage/
    quota.ts
    persistence.ts

  backup/
    backupFormat.ts
    createBackup.ts
    restoreBackup.ts
    validateBackup.ts
```

ファイル分割は適切に調整可。

巨大1ファイル禁止。

---

# 8. Phase C — IndexedDB

既存`src/cache.ts`はresponse cacheとして設計されている。

そのままPrimary Databaseへ無理に変形しない。

新DB:

```text
prompt-tree-local
```

を作成。

Object storesはv4 spec準拠。

`idb`を利用。

Upgrade functionにUnit Test。

---

# 9. Phase D — Workspace Model

`active_workspace_id`をControl Storeへ。

初回:

UUID workspaceを自動作成。

全research recordに`workspace_id`。

UIにWorkspace switcherは不要。

目的:

**Atomic Restore**。

---

# 10. Phase E — OPFS

実装:

```ts
navigator.storage.getDirectory()
```

からRoot取得。

Path:

```text
prompt-tree/workspaces/{workspace}/cards/{card}/images/{image}/
```

Original:

原byte。

Thumbnail:

webp。

Display IDをpathに使わない。

---

# 11. OPFS Compatibility

Runtime capability detection。

Write APIが使えない場合:

`IndexedDbBlobFileStore`。

Storage backendをImage metadataへ記録。

同一Imageを両方へduplicateしない。

---

# 12. Phase F — Replace `src/api.ts`

最終的にComponentから`api("/...")`をなくす。

優先順:

1. Home
2. Detail
3. Editor
4. Tree
5. Gallery
6. Viewer
7. Search
8. Settings

Typed repository callへ。

例:

Before:

```ts
api<Series[]>("/series")
```

After:

```ts
seriesRepository.list()
```

Before:

```ts
api<Card>(`/cards/${id}`)
```

After:

```ts
cardRepository.get(id)
```

---

# 13. Replace `useData.ts`

Current:

```ts
useData(path)
```

をLocal loader型へ。

例:

```ts
useLocalData(
  ["card", id],
  () => cardRepository.get(id)
)
```

またはfeature-specific hooks:

```ts
useCard(id)
useSeriesList()
useTree(seriesId)
```

現行`data-changed`event方式をMigration中利用してもよい。

完成形はtype-safeであること。

---

# 14. Rewrite `src/images.ts`

現在の`/api/images/...`を全廃。

保持するもの:

- file validation
- thumbnail generation
- HEIC conversion
- dimensions

追加:

- LocalFileStore write
- read
- object URL
- quota preflight
- QuotaExceeded handling

削除:

- remote upload
- network image URL

---

# 15. Rewrite `Thumb.tsx`

Current `thumbnailBlob()`はserver fetch + cache。

変更後:

```ts
localImageService.thumbnailObjectUrl(imageId)
```

など。

Unmount/LRUでURL revoke。

大量GridでMemory leakを起こさない。

---

# 16. Rewrite `Viewer.tsx`

Current:

```ts
fetch(imageUrl(...))
```

削除。

PhotoSwipeへLocal Object URLを渡す。

Save:

Local Blob/FileをWeb Shareへ。

Prompt:

Local Card Repository。

Tree navigationは既存。

---

# 17. Rewrite `Editor.tsx`

重要。

Current Online check:

```text
if (!navigator.onLine) ...
```

等を削除。

v4はOffline write可能。

SubmitはLocal transaction。

Multi-image local import。

Parent selectionはLocal tree data。

Draft保持。

---

# 18. Rewrite `ImageControls.tsx`

すべてLocal repository。

Image:

- favorite
- cover
- reorder
- replace
- delete
- add

Original file operationsとmetadata整合。

---

# 19. Rewrite `Home.tsx`

UIはなるべく変更しない。

Data sourceだけlocal。

ReorderはIndexedDB transaction。

Root ThumbはLocal Object URL。

---

# 20. Rewrite `Tree.tsx`

最重要。

UI/gestureを作り直さない。

現在のReact Flow実装を維持。

変更:

- `api()` calls → tree/card repositories
- Viewport → IndexedDB
- Edge CRUD → IndexedDB
- Node position → IndexedDB
- Undo callbacks → Local repositories

必ず既存viewport/back/no-scroll behaviorを壊していないかE2E再確認。

---

# 21. Rewrite `Gallery.tsx`

既存virtualizer維持。

Server cursorをLocal cursor abstractionへ。

要求:

10,000 image metadataを一括React stateへ入れない。

IndexedDB Index:

- workspace
- series
- created_at
- favorite
- card/root flagへのquery支援

必要ならImage recordへ`is_root`denormalized fieldを追加可。

Schema整合を優先。

---

# 22. Rewrite `Search.tsx`

Server `/api/search`削除。

Local Search Service。

まず正確性優先。

Main thread freezeが見えたらWorker化。

少なくとも数千Card benchmark。

Search state/backを維持。

---

# 23. Rewrite `AuthGate.tsx`

削除:

- `/auth/status`
- master password
- register
- invitations
- accounts
- server session
- login
- logout all
- account changed

残す:

- private screen
- 5min timer
- pointer/touch activity
- visibility
- app-lock event
- PIN form UX

新規:

- first launch PIN setup
- local PIN verify
- local backoff
- `navigator.storage.persist()` onboarding

---

# 24. Delete Invitations

`src/Invitations.tsx`削除。

Settingsから招待管理削除。

`docs/INVITED_ACCOUNTS.md`はHistorical folderへ移すか削除。

v4ではsingle local user。

---

# 25. Rewrite `Settings.tsx`

新しいGroup:

## セキュリティ

- PIN変更
- 手動Lock

## ストレージ

- Persistent Storage status
- usage
- quota estimate
- image count
- card count

## バックアップ

- last backup
- Complete Backup
- Restore

## アプリ

- version
- update status
- data reset

Cloud login/logout/invite/remove。

---

# 26. Persistent Storage

First runまたはSettings actionから:

```ts
navigator.storage.persist()
```

Resultを表示。

`persisted()`

も。

unsupported state。

Storage persistenceは保証でないためbackup messageを維持。

---

# 27. Rewrite `PwaStatus.tsx`

Current offline bannerはCloud版の「Offline limitation」前提。

v4ではOfflineは正常。

したがって:

- Offline warningを原則削除
- optional small "オフライン" statusは可
- Update bannerは維持

Offlineでも編集できる。

---

# 28. Rewrite Backup

Current server `/api/export/*`を削除。

`fflate`をclientで利用。

Full Backup:

- manifest
- data
- originals

Restore実装。

旧v3 lightweight exportを追加機能として残してもよい。

しかしv4完成条件はFull Restore。

---

# 29. Backup Workspace Staging

Restoreは絶対にexisting workspaceを先にclearしない。

新workspaceへstage。

OPFS:

new workspace folder。

IndexedDB:

records with new workspace ID。

全完了後:

`active_workspace_id` switch。

Failure:

old active unchanged。

---

# 30. Backup Parting

iPhone memory対策。

1巨大ZIP禁止。

Part size constant。

例:

```ts
BACKUP_PART_TARGET_BYTES
```

実機調整。

各partにbackup ID。

Restoreは欠落partを検出。

---

# 31. Backup Verification

Restore前:

- format version
- backup id
- part count
- record count
- image count
- size
- optional SHA-256

validation。

Corrupt backupで既存dataを消さない。

---

# 32. Phase G — Remove Worker

Local functionalityが代替できた後:

```text
worker/
migrations/
wrangler.jsonc
wrangler.production.jsonc
.dev.vars.example
```

をProject runtimeから削除。

Git historyに残るので、source fileを残す必要なし。

`docs/DEPLOYMENT_STATUS.md`は`docs/legacy-cloud/`へ移すか、明確にDEPRECATEDとする。

---

# 33. package.json Rewrite

Remove:

```text
@cloudflare/workers-types
wrangler
```

Scriptsから:

- `dev:api`
- D1 migrate
- deploy
- wrangler dry-run

を削除。

最終例:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview --host 127.0.0.1 --port 4173",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "test": "vitest run",
    "test:e2e": "playwright test"
  }
}
```

必要に応じ調整。

---

# 34. vite.config Rewrite

削除:

```text
/api proxy
navigateFallbackDenylist /^\/api/
```

PWA app shell precache維持。

Static hosting対応。

RouterをHashRouterへ変更する場合のbase pathも検証。

---

# 35. Router

Static host provider independentを優先。

推奨:

`HashRouter`

既存Overlay RoutingをHashRouterでも維持。

もしBrowserRouterを残すなら、static host deep-link fallbackを必須確認。

---

# 36. Playwright Rewrite

Current server:

Wrangler 8787。

変更:

Vite build + preview。

E2EはUI中心。

API request direct testを削除/置換。

Test helperをbrowser sideへinjectしてLocal Repositoryをinspectしてよい。

ただし本番コードへtest-only backdoorを残さない。

---

# 37. E2E Rewrite Priority

現行Test scenarioを失わない。

最優先:

1. Home create/reorder
2. Multi image
3. Tree viewport exact
4. Body scroll zero
5. Parent/Reference
6. Gallery virtualization
7. Search
8. Local PIN
9. Full offline write
10. Backup/Restore
11. Original byte integrity
12. Quota failure

---

# 38. Remove Account Tests

削除/書き換え:

```text
e2e/accounts.spec.ts
tests/accounts-migration.test.ts
```

Invitation semanticsはv4に存在しない。

Auth testsはLocal PINへRewrite。

---

# 39. Local Persistence E2E

必須新Test:

```text
Create data
reload
assert data exists
close/reopen context if feasible
assert data exists
```

IndexedDB + OPFS両方確認。

---

# 40. Offline CRUD E2E

Browser offline mode。

以下が成功:

- create Series
- add Card
- edit Prompt
- image favorite
- node move
- search

Service Worker app shellを使うE2Eも別途。

---

# 41. OPFS Byte Integrity

Small PNG fixture。

Import。

LocalFileStore read。

SHA/byte compare。

Thumbnail別。

---

# 42. Backup Restore E2E

Data:

- A-000 + 5 images
- A-001
- A-002
- multi parent
- reference
- tags
- rating
- custom Tree positions

Backup。

新workspace restore。

すべて一致。

---

# 43. Restore Failure E2E

意図的にpart破損。

Restore reject。

Active workspace id unchanged。

Old images accessible。

---

# 44. Storage Quota E2E

Storage serviceをdependency injection可能に。

QuotaExceeded mock。

Image import failure。

Card metadataがreadyにならない。

UI message。

---

# 45. Keep Current Tree Acceptance

絶対Regression禁止:

- exact viewport
- 20 back cycles
- body scroll zero
- node long press only
- portrait/landscape
- cycle reject
- undo/redo

---

# 46. Static Hosting Build

最終`dist/`はBackendなしで動く。

Production start後、DevTools NetworkでUser Data CRUD中に`/api` requestが0であること。

Code search:

```text
"/api/"
"wrangler"
"D1"
"R2Bucket"
"Cloudflare"
```

を行い、Runtime dependencyが残っていないこと。

DocsのHistorical mentionは可。

---

# 47. Runtime Network Audit

Production buildで:

Card create
Image import
Tree move
Search
Backup

を行う。

User Data operationsでNetwork requestを発生させない。

PWA asset/update requestは例外。

---

# 48. CSP / External Dependency Audit

External CDN 0。

Font external 0。

Analytics 0。

可能ならProduction CSPでunexpected connectをblock。

---

# 49. README Rewrite

Cloudflare sectionsを削除。

新README:

1. Product overview
2. Local-only architecture
3. Install
4. Dev
5. Build
6. Test
7. Static hosting
8. iPhone install
9. Local storage
10. Persistent storage
11. Backup
12. Restore
13. PIN
14. Data reset
15. Storage limitations
16. iPhone acceptance
17. Known limitations

---

# 50. Legacy Docs

旧Cloud docsは誤操作を招く。

以下は`docs/legacy-cloud/`へ移動推奨:

- DEPLOYMENT_STATUS.md
- INVITED_ACCOUNTS.md
- old v3 master
- old cloud setup sections

Header:

```text
DEPRECATED — DO NOT FOLLOW FOR v4
```

現行READMEからLinkしない。

---

# 51. Storage Warnings

Settingsで:

```text
このアプリのデータはこの端末に保存されています。
端末故障・サイトデータ削除・アプリ削除に備え、
定期的にバックアップしてください。
```

Persistent Storage trueでもBackup推奨。

---

# 52. Data Reset

Settings:

`すべてのローカルデータを削除`

Danger Zone。

二段階Confirm。

例:

```text
DELETE
```

の入力を求めてもよい。

対象:

- IndexedDB workspace data
- OPFS Prompt Tree directory
- PIN / settings
- caches

PWA app shell自体は残ってもよい。

---

# 53. Current Cloud Data Import

Automatic remote import禁止。

今回のmigrationではCloudflareへNetwork connectionを行わない。

もしユーザーが将来Cloud data importを希望した時だけ別Task。

---

# 54. Physical iPhone Gate

CodexはPlaywright WebKit passだけで「iPhone完全対応」と断定しない。

Final report:

```text
自動テスト: PASS
実機iPhone: 未確認
```

と分ける。

ユーザーが実機で確認するChecklistをREADME/docsに作る。

---

# 55. Git Safety

既存Sourceを大改造するため、Phaseごとcommit推奨。

例:

```text
chore: freeze cloud deployment
feat: add local indexeddb repository
feat: add opfs image store
refactor: migrate home and card data access
refactor: migrate tree to local repository
feat: add local backup restore
test: rewrite offline e2e
chore: remove cloudflare runtime
```

ユーザーのremoteへ勝手にpushしない。

---

# 56. Migration Completion Criteria

以下すべてで完了。

- [ ] `worker/` runtime removed
- [ ] D1 removed
- [ ] R2 removed
- [ ] Wrangler removed
- [ ] no runtime `/api`
- [ ] IndexedDB primary DB
- [ ] OPFS primary images
- [ ] fallback file store
- [ ] offline full CRUD
- [ ] HOME preserved
- [ ] TREE preserved
- [ ] Gallery preserved
- [ ] 1 Card many images
- [ ] exact Tree back
- [ ] body scroll zero
- [ ] PIN local
- [ ] 5min lock
- [ ] persistent storage UI
- [ ] quota UI
- [ ] Full Backup
- [ ] Full Restore
- [ ] failed Restore safe
- [ ] tests pass
- [ ] production static build pass
- [ ] README rewritten
- [ ] no paid service requirement

---

# 57. Required Commands / Gates

各Phaseで最低:

```text
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build
```

Relevant phaseで:

```text
pnpm run test:e2e
```

Failしたまま次へ進まない。

---

# 58. Final Verification Search

最後にrepository全体をsearch。

Runtime source内に以下が残っていれば調査。

```text
wrangler
D1Database
R2Bucket
CF-Connecting-IP
/api/auth
/api/images
/api/series
Cloudflare
INVITED
```

Historical docs以外にCloud runtime codeが残っていないこと。

---

# 59. Final Report

最後に報告:

## A. 再利用した既存実装

具体的files。

## B. Rewriteしたfiles

具体的files。

## C. DeleteしたCloudfiles

具体的files。

## D. Local Architecture

IndexedDB/OPFS。

## E. Backup Restore

形式とtest。

## F. Tests

typecheck/lint/unit/E2E/build。

## G. iPhone

実機未確認なら明示。

## H. Billing

`このv4実装にCloudflare R2/D1/Workersの課金runtimeは不要`

と明示。

---

# 60. 実装開始指示

`docs/PROMPT_TREE_MASTER_SPEC_v4_LOCAL_OFFLINE.md`を全文読み、
本Migration promptと合わせて実行してください。

まず既存sourceとlocal stateを再監査。

重大なデータ消失riskがなければ、
Cloud deploymentをfreezeしたうえでPhaseごとに実装してください。

軽微な判断で停止せず進めてください。

ただし既存Local User Dataが検出された場合だけ、
それを消さずにmigration方法を確定してからCloud code削除へ進んでください。

**R2 activation、Cloud deployment、Remote D1 operationは実行しないでください。**

---

# ============================================================
# === END OF CODEX LOCAL MIGRATION MASTER PROMPT ===
# ============================================================
