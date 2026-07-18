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
   `ops2@dev.local` (DOC.3 second ops) and `treasury2@dev.local` (disbursement checker).
   ⚠️ `DevDataSeeder` only seeds when `admin_user` is empty, so on a **pre-existing** dev DB a newly
   added seed account (e.g. `ops2@`) will be missing until the DB is re-seeded. `s5golive.mjs` needs
   `ops2@`; if its login 401s, re-seed the dev DB (or provision the account) first.

## Run
```
npm run e2e                     # both suites
node scripts/e2e/moneyflow.mjs  # money-flow trio only
node scripts/e2e/s5golive.mjs   # go-live pipeline only
```
Each prints per-step `✓/✗` and a `RESULT: N passed, M failed` line; non-zero exit on any failure.
Every run mints fresh listings (via `/dev/seed-listing`), so suites are repeatable and don't collide.
The backend base URL is `http://localhost:8080/api/v1` (constant in `lib.mjs`).
