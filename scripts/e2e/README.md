# Deal-flow write E2E harnesses

Node harnesses that drive the platform's **money-flow write commands** against the **live** Spring
backend exactly as the UI service modules (`src/api/services/*`) call them — same paths, bodies,
command envelope, and version threading. They exist to regression-check the deal-flow writes that the
mock's `DATA_MODE=live` mode targets (S5 go-live, S6 disbursement, S7 maturity/distribution, S12
subscribe).

## Files
- `lib.mjs` — shared transport: `api/cmd/get`, two-step OTP `login(email)`, `seed(stage)` (calls
  `/dev/seed-listing`), and a tiny `check/summary` assertion helper. Mirrors `client.js` + `envelope.js`
  + `auth.js`.
Onboarding chains (each drives the full command sequence with SoD role hand-offs; unique PAN/GSTIN/CIN per run):
- `supplier-onboarding.mjs` — S3: create → identity → submit-kyc → **kyc-approve (COMPLIANCE)** → financial →
  **credit-review (CREDIT)** → maa → activate → `active`.
- `buyer-onboarding.mjs` — S4: **nominate (CREDIT)** → identity → **credit-assess (CREDIT)** → engagement →
  ack-user → payment-instruction → activate → `active` (BA.3 gate).
- `investor-onboarding.mjs` — S10: **issue-invite (COMPLIANCE)** → sign-up → identity → submit-kyc →
  **assess-suitability (COMPLIANCE)** → financial → **kyc-approve (COMPLIANCE)** → mia → activate → `active`.
- `invoice-submit.mjs` — S14 origination: create listing (`POST /listings` → deal_invoice `submitted`) →
  BC16 doc flow (initiate → PUT → finalize → attach) → shows in the supplier tracker.

Self-service + portals:
- `investor-portfolio.mjs` — S13: investor login → own portfolio `{rows,summary}` + tax; cross-tenant → 403.
- `investor-self-commit.mjs` — BE-18: passwordless login → self-commit → cross-tenant 403 → ops-on-behalf.
- `buyer-portal.mjs` — BE-15: ack-user login → own ack-invoices/payment-instruction → self-ack → cross-tenant 403.
- `logout.mjs` — DL-BE-089: admin + investor → `POST /auth/logout` → bearer 401s → idempotent → re-login.

Deal flow:
- `moneyflow.mjs` — S12 subscribe, S6 approve-disbursement, S7 record-maturity + distribution, each on a
  listing fast-forwarded by `/dev/seed-listing` (stages `live` / `disbursable` / `disbursed`).
- `s5golive.mjs` — S5 go-live via the **real two-ops pipeline**: create → ops-checks → BC16 invoice-doc
  upload → `document_completeness` (DOC.3: uploader rejected, `ops2@` accepted) → complete → buyer-ack →
  snapshot-and-ready → approve-go-live → `live` + VA.

## Prerequisites
1. **Backend running on `:8080`, `dev` profile** (exposes `/dev/*`):
   ```
   cd ../fintech-platform-backend
   ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
   ```
2. **Seed accounts present** — the seven `*@dev.local` admins (password `DevPass123!`), incl.
   `ops2@dev.local` (DOC.3 second ops) and `treasury2@dev.local` (disbursement checker). As of **DL-BE-087**
   the seeder *ensures* each admin per-email on every dev boot, so all seven land even on a pre-existing DB —
   no wipe needed. (If `ops2@` ever 401s, you're on a backend build older than DL-BE-087; rebuild/restart.)

## Run
```
npm run e2e                              # all 9 suites (104 checks)
node scripts/e2e/supplier-onboarding.mjs # a single suite
```
Each prints per-step `✓/✗` and a `RESULT: N passed, M failed` line; non-zero exit on any failure.
Every run mints fresh listings (via `/dev/seed-listing`), so suites are repeatable and don't collide.
The backend base URL is `http://localhost:8080/api/v1` (constant in `lib.mjs`).
