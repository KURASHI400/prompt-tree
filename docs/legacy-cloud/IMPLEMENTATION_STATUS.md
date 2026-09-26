> DEPRECATED — DO NOT FOLLOW FOR v4
> 旧クラウド版の履歴資料です。現行仕様は ../PROMPT_TREE_MASTER_SPEC_v4_LOCAL_OFFLINE.md です。

# Implementation record

The sole master specification is `PROMPT_TREE_MASTER_SPEC.md`, copied byte-for-byte from the v3 attachment explicitly selected by the owner on 2026-09-23.

## Phase 0

Inspected the requested OneDrive/ドキュメント/PromptTree directory and the task workspace. No package.json, lockfile, source code, Cloudflare config, migrations, or Git repository existed. The only original file was the v3 attachment. No existing artifacts were removed. Initialized a local Git repository. Node 24 is available; bundled pnpm is used because npm is not on PATH.

Pre-code gates are not applicable to the original document-only folder. Executable gates begin with Phase 1.

## Plan and gates

1. Foundation: React/TS/router/PWA, Worker, D1/R2, migrations, owner authentication, PIN, privacy and lock.
2. Home and Series: atomic root creation, thumbnails, reorder, detail and back context.
3. Cards and Images: upload/retry, originals, HEIC thumbnails, editing, viewer and image operations.
4. Tree: independent canvases, gestures, edges, exact viewport, persistence and undo.
5. Images: cursor pagination, virtual grid, filters, selection and viewer context.
6. Search and Export: indexed search, cursor state, bounded/streamed originals and metadata.
7. Mobile hardening: offline cache, safe areas, privacy, keyboard, orientation and touch.
8. Final QA: all gates, security/integrity, synthetic performance, deployment docs.

Each phase requires typecheck, lint, unit tests, relevant integration/E2E, and production build before the next phase. Actual device and production checks will be reported separately from local emulation; no claim of physical iPhone validation without a device.

## Phase 1 gate — passed
Typecheck and lint passed. Vitest 4 authentication tests passed. D1 migrations applied locally. Browser E2E passed for master password, PIN, CSRF rejection, locked API and 5-minute auto lock. Vite production and Worker dry-run builds passed. Workerd/esbuild required execution outside the Windows sandbox after read permission grants did not resolve child-process access errors. No remote deployment occurred.

## Phase 2 gate — passed
Typecheck, lint, 9 unit tests, 2 mobile E2E tests, production build and Worker dry-run passed. Local D1/R2 end-to-end creation preserved original bytes. Accessible HOME tile names corrected following initial E2E failure. HEIC decoder is a separate lazy chunk.

## Phase 3 gate — passed
Typecheck, lint, 9 unit tests, 3 mobile E2E tests and both builds passed. E2E verifies five images per experiment, input order, cover fallback, image favorite, version conflict, independent R2 copies and PhotoSwipe open/close. Physical HEIC/iPhone validation remains outstanding.

## Phase 4 gate — passed
Typecheck, lint, unit tests, 4 E2E tests, production and Worker builds passed. Exact viewport/style and card screen rectangle compared across Detail Back. Body/document scroll remain zero; parent cycle rejected, reference reverse edge accepted, rotation does not change card coordinates. Physical touch validation still required.

## Phase 5 gate — passed
Typecheck, lint, 10 unit tests, 5 E2E scenarios and both builds passed (gallery rerun after correcting asynchronous filter wait). Local D1 holds 10,000 synthetic image records. API pages contain 120 distinct records, DOM fewer than 100 image cells, and Viewer close preserves scroll. No remote data was seeded.

## Phase 6 gate — passed
Typecheck, lint, 12 unit tests, search/export E2E and both builds passed. ZIP original compared byte-for-byte, UTF-8 CSV/JSON and single-character Japanese indexed search validated.

## Phase 7 gate — passed
Typecheck, lint, 13 unit tests, 14 E2E scenarios across Chromium and WebKit and both builds passed. Offline PIN and cached detail protect sensitive UI, offline editing rejected. WebKit thumbnail cache uses ArrayBuffer for IndexedDB compatibility. Long-press move/Undo persist correctly. Physical iPhone is not available.

## Phase 8 — local gates passed; production and physical-device acceptance pending
Typecheck, lint, 18 unit tests, 22 Chromium/WebKit E2E cases, production build and Worker dry-run passed. All six migrations were exercised both from an empty in-memory SQLite database and on the local D1 runtime. The final CSS adjustment fixes long Series labels and image-row gaps. The full suite was rerun after this adjustment and test-results/.last-run.json records passed with no failed tests.

Additional API coverage verifies multiple parents, Primary promotion, root-only/auto-child rename, preservation of custom IDs, Series move and relationship cleanup, non-reused child numbers, immutable originals, interrupted-upload recovery, synced provider setting, PIN backoff and logout-all revocation. HOME long-press reorder and reload persistence pass in both browsers. Service Worker interception is disabled only for the deliberate upload-failure test.

300-node / 299-edge synthetic TREE check: 9 nodes initially mounted, 300 visible after Fit View, zero Original requests and zero document/body scroll. Local Chromium navigation through Fit View took 1,062 ms in this single diagnostic run. Graph response was 154,576 bytes. This is a development-host measurement, not a physical iPhone performance guarantee.

Test data is isolated in work/e2e-state. Normal development uses .wrangler/state. Existing local servers are never reused by E2E. Secrets and generated databases are excluded from Git. The original attachment and sole master specification have identical SHA-256: 036a3ffcd5209571160db941ba78ea7b06bf3cda99c8e518259e1642f7b7f62f.

README includes all 18 required sections, an owner-operated recovery SQL generator, private R2/D1 deployment instructions and a physical iPhone acceptance checklist. Cloudflare CLI whoami reports not authenticated with both normal and test-local configuration. No remote resources, GitHub connection, or production deployment have been created. Physical iPhone acceptance is outstanding; the overall master-spec completion gate is therefore not yet satisfied.

## Invited-account update — local gates passed (2026-09-24)

User explicitly requested a public entry URL with private personal data and invitation-only registration. This supersedes the original single-owner restriction for authentication only; the master specification file is preserved unchanged.

Implemented administrator-issued invitations (256-bit token, hashed at rest, seven-day expiry, single use and revocation), individual usernames/passwords, per-account PIN/backoff/auto-lock, ownership checks across all data APIs and R2 reads/writes, per-account logout-all, scoped cache keys, cache/draft/Undo clearing on account changes, stale response rejection and cross-tab account-change handling.

Typecheck, lint, 19 unit tests, 26 E2E cases (13 per Chromium/WebKit), Vite production build and Worker deployment dry-run passed together. test-results/.last-run.json records passed with no failures. E2E exercises concurrent use of one invitation, revocation, non-administrator rejection, API isolation including Original bytes and modification endpoints, per-account logout-all, registration UI, cached data removal, cross-tab hiding and offline PIN separation. Existing TREE viewport/body-scroll, multi-image Card, gallery, upload-retry and Original-integrity tests continue to pass.

Migration 0007 was validated with populated owner data: credentials and all dependent records remain identical, and foreign_key_check is empty. It also applied successfully to the existing local D1 test database. The normal local database was backed up to work/backups/before-invited-accounts-20260924-063725/state (19 files, 1,880,488 bytes), migrated and checked. Normal user/series/card/image/edge counts were all zero before and after, with no foreign-key violations. Test accounts are confined to the isolated E2E database.

Production remains pending Cloudflare account authorization and remote resource configuration. No temporary preview account, production database or public R2 bucket was created. Physical iPhone acceptance remains outstanding.

## Production preparation — Cloudflare authorized; R2 subscription pending (2026-09-24)

Cloudflare OAuth authorization succeeded. A new D1 database named prompt-tree was created in APAC (remote execution reported KIX), with database ID 2f436aef-90de-4695-9252-a66859753f16. All seven migrations applied successfully. Remote foreign_key_check returned no violations and users count is zero. No local/test data was uploaded.

wrangler.production.jsonc now records the actual deployment bindings and account. The local wrangler.jsonc remains unchanged to preserve local database identity. npm run deploy targets the production configuration. Worker dry-run with production bindings passed. No Worker deployment or R2 bucket exists yet.

Email verification is now reflected in Cloudflare. R2 is disabled and its dashboard displays the subscription checkout: $0 upfront, Standard free monthly allowance of 10 GB-month, 1 million Class A and 10 million Class B operations; paid overages and automatic renewal apply. The user was asked to explicitly approve this contract under their instruction to report paid-service additions. The subscription button has not been clicked.
