> DEPRECATED — DO NOT FOLLOW FOR v4
> 旧クラウド版の履歴資料です。現行仕様は ../PROMPT_TREE_MASTER_SPEC_v4_LOCAL_OFFLINE.md です。

# Public deployment status — 2026-09-24

- Cloudflare OAuth: authenticated (credentials are local only under ignored work/config).
- Cloudflare email verification: completed.
- Dedicated production D1: prompt-tree / 2f436aef-90de-4695-9252-a66859753f16, APAC.
- Remote schema: migrations 0001–0007 applied; foreign_key_check empty; users=0.
- Production config: wrangler.production.jsonc. Local config/database identity remains unchanged.
- Production dry-run: passed. Latest typecheck and lint: passed.
- R2 subscription: user explicitly approved the quoted Standard free tier and paid overage/automatic-renewal terms on 2026-09-24. Do not request the same approval again.
- Clicked Add R2 subscription to my account. Cloudflare now requires payment method and billing address at /r2/checkout/payment. User is entering these directly in Cloudflare. No payment data is held by the project.
- Waiting for the user to complete Activate R2. No R2 bucket or production Worker has been created yet; there is no public app URL yet.

After R2 activation: verify bucket list, create private Standard bucket prompt-tree-private, configure a fresh secret SETUP_TOKEN (not a test credential), deploy with wrangler.production.jsonc, verify public HTTPS login/assets, unauthenticated API denial, and security headers. First-owner password and PIN must be chosen by the user through the app. Do not upload local or E2E data into production. Preserve Original bytes and require owner/session/PIN checks for all image access.

Last full local application gates: 19 unit tests and 26 Chromium/WebKit E2E passed, production build and Worker dry-run passed. Physical iPhone acceptance remains outstanding.
