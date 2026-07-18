# UI WORK ORDER — current increment

> **What this is.** The single **active** UI task, scoped from the cross-repo tracker
> (`../fintech-platform-backend/docs/PROJECT_TRACKER.md` §5 Track A). Execute it **in this repo's own Claude
> session**. It is a thin checklist — the full step text lives in [`INTEGRATION_PLAN.md`](INTEGRATION_PLAN.md);
> per-screen shapes in [`API_ALIGNMENT.md`](API_ALIGNMENT.md). Don't duplicate those here.
>
> **Golden rules:** (1) backend is the source of truth — match its shapes, never reshape to suit the UI.
> (2) The **offline mock path must keep working** (`DATA_MODE=mock` default) — live wiring is additive.
> (3) `npm run build` stays green after every step.
>
> **Branch:** `feat/bridge-phase0-2` · **Updated:** 2026-07-17

---

## Increment: the bridge foundation + live login (Phase 0 + Phase 1 + Phase 2)

Goal: a browser that reaches the backend with no CORS error, a transport layer that knows the bearer + command
envelope + error shape, and **S1 login working live** for the seeded dev admins. After this, read-only screens
(S2–S8, S12, S14) become one-liners.

**Backend is ready** (BE-1…BE-12 shipped). Start it in dev before the `[needs backend]` steps:
`./mvnw spring-boot:run -Dspring-boot.run.profiles=dev` → API `:8080/api/v1`, seed password `DevPass123!`,
OTP peek `GET /dev/last-otp?email=`, ids via `GET /dev/seed-info`.

### Already done — do NOT redo
- ✅ `src/config.js` — the `DATA_MODE` / `API_BASE` / `IS_LIVE` / `IS_DEV_BACKEND` seam exists (INTEGRATION_PLAN 0.3).

### Phase 0 — Environment
- [x] **0.2 Vite dev proxy** — `vite.config.js`: `server.proxy` `'/api' → http://localhost:8080`
  (`changeOrigin:true`). App calls stay **relative** (`/api/v1/...`).
  *Verified:* `/api/v1/dev/seed-info` returns seed ids through the proxy, no CORS error.

### Phase 1 — API client core (new `src/api/`)
- [x] **1.1 `src/api/client.js`** — `request(method, path, {body, bearer, commandId, aggregateVersion, raw, contentType})`
  → `{status, data, headers}`; assembles `Authorization`/`Content-Type`/`X-Command-Id`/`X-Aggregate-Version`;
  JSON or raw body; parses JSON/binary/204/text; throws `ApiError` on `!res.ok`. Module-level
  `getBearer()`/`setBearer()` added.
- [x] **1.2 `src/api/envelope.js`** — `newCommandId()=crypto.randomUUID()`; `postCommand`/`putCommand` (thread
  `aggregate_version`; creation takes none); `readById`. Returns the envelope.
- [x] **1.3 `ApiError` (client.js) + `src/api/errors.js`** — carries the full B4 error body; helpers
  `isConflict/isForbidden/isValidation/isAuthFailure/describe`. *Verified* against the live bad-password
  (`bad_credentials`/`auth_failure`/401) and no-bearer (`bearer_missing`) bodies.

### Phase 2 — Auth & session (S1 live)
- [x] **2.1 `src/api/services/auth.js`** — `loginPassword` → `{challenge_id}`; `verifyOtp` → `{bearer}`;
  `devLastOtp` (guarded to `IS_DEV_BACKEND`). *Verified* full 3-call sequence through the proxy.
- [x] **2.2 `src/context/AuthContext.jsx`** — `{bearer,email,loginStep,challengeId}` + `beginLogin/completeLogin/logout`;
  persists to `sessionStorage` (live only); syncs `setBearer()`. Wrapped in `App.jsx` **outside** `PersonaProvider`;
  inert shim in mock mode.
- [x] **2.3 Wire S1 live** — `S1.jsx` splits `LiveLogin`/`MockLogin` (mock byte-identical); `App.jsx` `handleLogin`
  accepts a routes-persona-id or a mock id; `routes.js` gains `LIVE_LOGIN_PERSONA_MAP` (5 dev-account emails →
  1:1 persona, per `API_ALIGNMENT.md §1.4`). Live: email/password → `beginLogin` → OTP (auto-filled in dev) →
  `completeLogin` → persona from email → nav. `ApiError` surfaced inline. *Verified* login as ops@/credit@ +
  protected `GET /suppliers/{seeded}` with the bearer.

**Status: ✅ Phase 0–2 complete + verified** (build green, mock default unchanged, live login end-to-end through
the proxy). Remaining DoD: flip the backend tracker (below) + commit on `feat/bridge-phase0-2`.

---

## Definition of done
1. `npm run build` green; `DATA_MODE=mock` (default) behaves **exactly as before**.
2. `[needs backend]` live check: log in as each seeded dev admin → land on the right first screen; a protected
   `GET /suppliers/{seeded}` succeeds with the stored bearer; a bad password shows an inline error.
3. **Flip the tracker** (`../fintech-platform-backend/docs/PROJECT_TRACKER.md`): S1 **Wired live** cell → ✅ (or ⚠️
   if partial), and update §0 bridge state from "not started" to "auth wired". Bump its "Last updated".
4. Commit on `feat/bridge-phase0-2`; merge to `main` when you're happy (your call).

## Notes / gotchas
- **Dev accounts (confirmed from `DevDataSeeder`):** 6 seeded admins, password `DevPass123!` —
  `super@` / `ops@` / `credit@` / `compliance@` / `treasury@` / `treasury2@` `dev.local`. The **live email→persona
  map is resolved** — 5 exact 1:1 rows (backend role = UI persona); the composite `ops-treasury` and
  `auditor`/`investor`/`supplier`/`buyer` are **intentionally not live-mapped** (documented, revisit later).
  **Canonical table: `API_ALIGNMENT.md §1.4`** (accounts also in `INTEGRATION_PLAN.md` Appendix A). Step 2.3: add a
  **new** live email→persona map for the 5 rows; leave the mock `LOGIN_PERSONA_MAP` (founder/ops_lead/credit_lead/
  auditor) untouched. Persona is advisory (UI nav only) — the backend enforces authz from the bearer's real roles.
- **DB must be up** before the `[needs backend]` steps: `docker compose up -d` in the backend repo, then
  `./mvnw spring-boot:run -Dspring-boot.run.profiles=dev`.
- `crypto.randomUUID()` is available (modern browsers / Vite dev) — use it for `X-Command-Id`.
- Keep API code under `src/api/`; no new UI component files unless a step says so (kit conventions in `CLAUDE.md`).
- 201 (created) and 200 (replayed/idempotent) both carry the envelope — treat both as success.

---

## Increment 2: Phase 3 — Service layer ✅ COMPLETE

The thin function-per-endpoint layer under `src/api/services/` (one module per bounded context), so wiring a
screen is a one-liner. Built from the backend `docs/API_CATALOGUE.md` (paths) + `API_ALIGNMENT.md §2` (shapes);
commands return the envelope and thread `X-Aggregate-Version`; the bearer is injected by the client.

- [x] `suppliers.js` (BC8) · `buyers.js` (BC9) · `investors.js` (BC7) · `listings.js` (BC1) · `subscriptions.js`
  (BC2) · `assignment.js` (BC5) · `settlement.js` (BC4) · `distributionTax.js` (BC12) · `credit.js` (BC3) ·
  `adminUsers.js` (IAM) · `dashboard.js` (BE-12) + `index.js` barrel.

**Verified** (live seed, `scratchpad/svc-check.mjs` — 16/16): every module's read returns the documented shape;
a `suppliers.create → recordIdentityVerified → get` walk proves the envelope + version threading (v1→v2); a
backend rejection surfaces as a parsed `ApiError`. Build green; mock default unchanged.

**Findings baked in:** supplier `create` requires **`cin`** (plan marked it optional); the backend maps a
duplicate-key (e.g. reused PAN) to a **500**, not 409 — worth a backend note, not a UI concern.

---

## Increment 3: Read-only screen wiring (fetch-into-store on mount) — IN PROGRESS

**Decision (founder):** hydration pattern = **fetch-into-store on mount**. Selectors stay synchronous; in live
mode a screen fetches its read(s) on mount and merges them into the store, then selectors read as usual — so
**screens don't change between mock and live**. Scope = **reads only**; write operations still hit the in-memory
store (command wiring is a later increment).

**Infrastructure built:**
- `src/store/PlatformStore.jsx` — `HYDRATE` action + `hydrate(patch)` (shallow-merges live collections/values over the seed).
- `src/store/live.js` — `liveLoaders`: one loader per resource (service call → store-shaped `byId` patch). Seeded: suppliers, buyers, invites, listings, marketplace, disbursements, dashboard.
- `src/store/useHydrate.js` — `useHydrate(keys, deps)` hook: live mode runs the loader(s) on mount + reports `{loading,error}`; **mock mode = no-op**.
- Live mode still seeds from mock, so un-wired screens keep working; wired screens replace their collection on mount (graceful screen-by-screen flip).

**Model-mapping sub-increment (built this pass):**
- `src/store/mappers.js` — backend `deal_listing_status` → the mock's split invoice/listing statuses;
  `mapListingDetail(detail, opsChecks)` (BE-10 → `{listings, invoices, buyers, suppliers}` with the backend
  `listing_id` used as both invoice_id + listing_id, ops-checks → `check_outcomes`) and
  `mapSupplierListings(rows, supplierId)` (BE-11 → store invoices with a nested `listing`).
- **Parametrized `useHydrate`** — spec `['listingDetail', id]` calls the loader with args and re-runs on dep
  change; **HYDRATE now has merge (by-id upsert) vs replace (whole-collection) modes** — list loaders replace,
  by-id loaders merge so they don't wipe other entities.

**Screens wired (reads):**
- [x] **S3** Suppliers — `useHydrate('suppliers')` → BE-4. *(writes still mock)*
- [x] **S4** Buyers — `useHydrate('buyers')` → BE-5. *(writes still mock)*
- [x] **S8** Investor invites — `useHydrate('invites')` → BE-9. *(list omits email/phone PII; writes still mock)*
- [x] **S6** Disbursement queue — `useHydrate('disbursements')` → BE-7. *(empty seed; approve still mock)*
- [x] **S11** Marketplace — `useHydrate('marketplace')` → BE-14. *(empty seed)*
- [x] **S12** Listing detail — `useHydrate(['listingDetail', id])` → BE-10 (detail + ops-checks). *(subscribe still mock)*
- [x] **S14** Supplier tracker — `useHydrate(['supplierListings', id])` → BE-11. *(buyer_name blank — not in BE-11; submit still mock)*
- [x] **S5** Invoice checks + approval — `useHydrate('opsListings')` (GET /listings → `opsInvoices` + approval list)
  + `useHydrate(['opsChecks', selectedId])` per-row (BE-6). Two-level fetch; ops-check outcomes normalized to
  pass/fail/pending. *(supplier/buyer names blank — BE-6 returns ids; checks/go-live writes still mock)*
- [x] **S2** Admin dashboard — `useHydrate('dashboard')` → BE-12 (`/admin/stats` + `/admin/work-queues`). Stats
  tiles map 1:1; work-queue is **mode-aware** — mock shows per-item rows, live shows per-queue **counts** (each
  still navigates to its screen via `QUEUE_NAME_SCREEN`). *(BE-12 has no per-item queue — counts only, by design)*

**Deferred (documented, not faked):**
- **S7** distribution/recon — **no** top-level distributions list endpoint (composed per-listing) → needs per-listing hydration.
- **S13** portfolio — `GET /investors/{id}/subscriptions` is **investor-scoped**; id comes from the investor session
  → belongs with the **investor-login** increment (BE-17/BE-18).

**Read-wiring is complete for every admin-context screen** (S2–S8, S11, S12, S14). S7 (composed per-listing read)
and S13 (needs investor login) remain by design.

**Read-wiring verified:** build green (both modes); harnesses `live-check`, `map-check`, `s5-check`, `s2-check`
pass; S2–S8/S11/S12/S14 serve 200 in live + mock; `useHydrate` is a no-op in mock.

---

## Increment 4: Write wiring (direct API, one-line branch) — IN PROGRESS

**Decision (founder):** writes are **plain direct API calls**, not a store-operation layer. A button handler
calls the service directly and refreshes — **no in-memory fallback** (a silent mock success would hide live bugs):

```js
// creation
await service.command(data); await live.reload()               // POST → GET refresh
// transition (needs the current version — list reads omit it, so read it fresh)
const { aggregate_version } = await service.get(id)
await service.transition(id, data, aggregate_version); await live.reload()   // POST + X-Aggregate-Version → refresh
```

- The write **always hits the backend** (no `mock` branch). Run live mode; in mock mode a wired write will error
  (mock ids don't exist backend-side) — which is the point: failures are visible, not masked.
- After a write, `useHydrate(...).reload()` re-fetches (the command returns an ack envelope, not the row).
- Errors: the service throws `ApiError` → the handler shows `describe(e)` inline; button shows busy.
- No parallel live-operations layer; `await` is just a normal AJAX call. `useHydrate` returns **`reload`**.

**Writes wired:**
- [x] **S8 Issue Invite** — `await investors.issueInvite({email, phone})` → `reload()`. Verified
  (`write-check.mjs`): POST → envelope, refresh shows the new invite (count grows, `pending`) — **persists**.
  *(revokeInvite stays mock — no backend endpoint.)*
- [x] **S4 buyer onboarding chain (full lifecycle)** — all direct backend commands, version threaded (fresh
  `buyersSvc.get(id)` per step), then `reload()`:
  - **Nominate** (new form) → `POST /buyers/nominate` (CREDIT).
  - **Advance chain** (`advanceStatus`): `record-identity-verified` (OPS) → `record-credit-assessment`
    {credit_limit_paise} (CREDIT, also the "Set Credit Limit" button) → `start-engagement` (OPS).
  - **Activation sub-chain** (`completeActivation`, at `engagement_started`): `designate-ack-user`
    {email,phone,display_name} → `confirm-payment-instruction` → `activate` (all OPS). Needed because **BA.3**:
    activation requires an active acknowledgment user, so it isn't a single transition.
  - Verified (`chain.mjs` + `activate.mjs`): a fresh buyer walks nominated → **active (v5)**, persisted; SoD
    enforced (identity-verified as CREDIT → **403**, shown inline); no unhandled backend errors.
  - **SoD reality for the live UI:** roles differ per step, and the TopBar persona is advisory — the real authz
    is the **logged-in dev account's** roles. So a full walk means **re-logging in** as `credit@`/`ops@` at the
    right steps; a step you lack the role for shows a 403 inline (correct). The seeded buyer is already `active`.

**Findings baked in:** the mock's buyer lifecycle is *simplified* vs the backend — `activate` has real
prerequisites (ack-user + payment instruction) the mock skipped; now modeled. Duplicate PAN/GSTIN/CIN and bad
IRN map to **500** (unhandled) rather than 4xx — a backend robustness gap (all 5 "Unhandled exception" log lines
are from those test cases, none from real flows).

- [x] **S3 supplier onboarding chain (full lifecycle)** — the wizard is now **status-driven** (each action = a
  direct backend command with a fresh version, then `reload()`), spanning **three roles** (SoD):
  - **Create** (new form) → `POST /suppliers/create` {legal_name, constitution_type, pan, gstin, cin} (OPS).
  - `record-identity-verified` (OPS) → `submit-kyc` (OPS) → **`record-kyc-approved` (COMPLIANCE, maker-checker)** →
    `submit-financial-profile` (OPS) + **`record-credit-review` {exposure_cap_paise, risk_rating} (CREDIT)** →
    `record-maa-signed` (OPS) → `activate` (OPS).
  - Verified (`sup-chain.mjs`): fresh supplier walks created → **active (v7)**, persisted; SoD enforced
    (kyc-approve as OPS → **403**); no unhandled backend errors. S3 serves 200 both modes.
  - Same SoD reality as S4: re-login as `ops@`/`compliance@`/`credit@` at the right steps; a step you lack the
    role for shows 403 inline. The old step-only click-through wizard is replaced.

- [~] **S6 Approve Disbursement** — wired: MFA → `settlement.disbursementApprove(listingId)`
  (`POST /listings/{id}/disbursement/approve`, TREASURY, checker ≠ maker) → `reload()` → S7. Fixed the **read
  mapping** too: `GET /disbursements` returns `{payout_instruction_id, listing_id, status, gross_amount,
  net_amount, maker_id, checker_id, listing_status}` → mapped to the store's disbursement shape (names blank —
  BE-7 returns ids; a drafted instruction implies the fully_funded ∧ all_signed gate). **Verification is limited:**
  the approve needs a **drafted disbursement**, which needs a **fully_funded + all_signed** listing — i.e. the
  whole deal pipeline. A pipeline harness drove create → ops-checks and confirmed each real prerequisite
  (`document_completeness` needs an attached invoice doc; then buyer-ack → snapshot → go-live → subscribe → fund
  → assignment-sign → draft → approve). Building that full setup is its own task. The approve command matches the
  verified `DisbursementService` contract; E2E awaits a disbursable listing.
  **Recommendation:** add a backend **dev helper** (like `/dev/seed-info`) that seeds a disbursable listing (or a
  drafted disbursement), so S6/S7 money-flow writes become testable without hand-driving ~20 commands.

- [x] **S5 record-ops-check** (Pass/Fail buttons) — `POST /listings/{id}/record-ops-check {check_name, outcome}`
  (OPS, version threaded). The handler auto-runs `start-ops-checks` if the listing is `draft`, then refreshes the
  check grid + list. buyer_ack routes to `record-buyer-ack`; "Send Ack Request" → `request-buyer-ack`. Verified
  (`s5-write.mjs`): create → start-ops-checks → record-ops-check **persisted** (irn_validity is a vendor check →
  backend derives `not_applicable`; `document_completeness` without an attached doc → **400 surfaced inline**).
  *(The mock "invoice" IS the backend listing — invoice_id = listing_id.)*

- [~] **S5 promote (snapshot-and-ready) + go-live** — wired: "Send to Listing Approval →" runs
  `complete-ops-checks → request-buyer-ack → record-buyer-ack → snapshot-and-ready {rate_bps}` (OPS, version
  threaded); "Approve Go-Live" (MFA) → `approve-go-live` (TREASURY, checker ≠ maker). A full pipeline harness
  (`golive.mjs`) verified create → start-ops-checks → **BC16 document upload** (initiate → PUT content → finalize →
  attach) → 6/7 ops-checks. **Blocked at go-live E2E by a seed gap, not the wiring:** `document_completeness` is
  **DOC.3 maker-checker** — attach (OPS) and record (OPS) must be *different* ops users, but the seed has only one
  `ops_executive`. So the real path to `ready_for_review`/`live` is unsatisfiable with the current seed. The wiring
  matches the verified `ListingService` contract; E2E needs the **dev seed helper** (`DEV_SEED_LISTING_HELPER.md`,
  now updated to also seed `ops2@dev.local`).

- [~] **S12 subscribe** — `POST /listings/{id}/subscriptions/commit {investor_id, amount_paise}` (ops-on-behalf,
  OPS) → refresh. **Live caveat:** `investor_id` must be a real backend id — `INVESTOR.id` is the mock placeholder
  (ties to the deferred investor-login + the dev seed helper, which returns a real investor_id).
- [~] **S7 record-maturity + distribution** — `POST …/record-maturity {amount_paise, utr}` (TREASURY); "Execute
  Distributions" → `distribution/draft` (maker) → `distribution/approve` (checker ≠ maker — needs a **second
  treasury** login). Reconciliation stays local (G6 — no read endpoint); S7's distribution *read* has no list
  endpoint, so its list stays projection.

**All wired ✅ where drivable; the deal-flow writes (S5 go-live, S6 approve, S7 maturity/distribution, S12
subscribe) are wired to verified contracts but E2E-blocked** on the deal pipeline + seed gaps (DOC.3 two-ops,
disbursable listing, real investor_id) — unblocked by the backend **`DEV_SEED_LISTING_HELPER`** (specced, adds
`ops2@dev.local` + stage seeding). No-endpoint writes (revokeInvite, buyer self-ack) stay mock.

**Write-wiring is functionally complete on the front-end** — every write button that has a backend command now
calls it directly (no fallback), with version threading + inline errors. What remains is backend-side (the dev
seeder) to make the deal-flow writes E2E-verifiable.

**Per-screen shape caveats to handle as each is wired** (backend list reads are intentionally thin):
BE-4 omits `agency_consent` (S3 Consent column blank live); BE-9 omits invite email/phone PII; BE-12
work-queues are counts-only (no clickable per-item queue like the mock composes). These stay projection/blank
until a richer read exists — flag, don't fake.

## After this increment
Continue read-wiring the remaining screens above (mechanical — add a loader + `useHydrate`). Then a separate
increment wires **write operations** to the service layer (envelope + re-read) so live mode persists. One work
order at a time.
