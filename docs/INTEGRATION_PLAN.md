# UI ⇄ Backend Live Integration — Step-wise Executable Spec

> 📍 **Cross-repo status & the single next-actions list live in the shared tracker:**
> `../fintech-platform-backend/docs/PROJECT_TRACKER.md`. This doc is the **UI-side executable detail** that
> tracker points to — do the steps here, but record *progress* (which screen is wired) in the tracker.

> **Audience: a Claude Code session.** This document is the build plan for wiring the React UI
> (`fintech-patform-ui`) to the live Spring Boot backend (`fintech-platform-backend`, served under
> `/api/v1`). It is organised into **phases → numbered steps**. Each step is independently reviewable and
> testable and states its own **Files**, **Do**, **Backend contract**, **Test**, and **Acceptance**.
>
> **Golden rule — backend is the source of truth.** Wherever the UI's current shape, enum, field name, or flow
> disagrees with the backend, **change the UI to match the backend**. Never reshape a request/response to suit
> the UI. The authoritative endpoint↔shape mapping is [`API_ALIGNMENT.md`](API_ALIGNMENT.md); the backend
> catalogue is `fintech-platform-backend/docs/API_CATALOGUE.md`; the golden-path request/response examples are
> `fintech-platform-backend/manual-test.http`. When this plan is silent or ambiguous on a shape, **read the
> backend controller** (`src/main/java/com/arthvritt/platform/*/*Controller.java`) and follow it exactly.
>
> **Execution rules for the implementing session**
> 1. Do the steps **in order**. Do not start a step until the previous step's Acceptance passes.
> 2. After each step: run `npm run build` (must stay green) and perform the step's **Test**.
> 3. Every step must preserve the **offline mock** path (see Phase 1, the `DATA_MODE` switch). The app must
>    still run with the backend down. Live wiring is additive, never destructive to the mock.
> 4. Keep screen JSX within the project's kit conventions (see `CLAUDE.md`). No new component files unless this
>    spec says so; API code lives under `src/api/`.
> 5. Commit at the end of each **phase** (not each step), on a branch, only if the user asks.

---

## 0. Orientation — what makes this backend different

The backend is **command-driven (CQRS-style)**, not REST CRUD. Three consequences drive the whole design:

1. **Two-step OTP auth.** `POST /auth/login/password {email,password}` → `{challenge_id}`; then
   `POST /auth/login/verify-otp {challenge_id,code}` → `{bearer}`. `bearer` is an opaque session id sent as
   `Authorization: Bearer <bearer>` on every later call. Stateless; no cookie.
2. **Every write is a command with an envelope.** All command POST/PUT need header `X-Command-Id: <uuid>`
   (idempotency). Transitions on an existing aggregate also need `X-Aggregate-Version: <int>` (optimistic
   lock). The response is **not the entity** — it is:
   ```json
   { "aggregate_id":"uuid", "aggregate_version":3,
     "emitted_events":[{"event_id":"uuid","event_type":"…","occurred_at":"ISO-8601"}],
     "correlation_id":"uuid" }
   ```
   So after any command the UI must **re-read** `GET …/{id}` to refresh display state, and carry the new
   `aggregate_version` into the next command on that aggregate.
3. **Reads are thin.** Every `GET` is fetch-one-by-id returning `{id, status, version}` (+ a few fields).
   **There are no list/search/dashboard/marketplace/audit endpoints.** The read gaps (G1–G13 in
   `API_ALIGNMENT.md §4`) stay on mock data until the backend adds read models. This plan wires **commands +
   by-id reads live**, and leaves the gap reads on mock — clearly flagged in the UI.

**Roles are enforced server-side, not by the UI.** Login returns only a bearer; there is no "current identity /
my roles" endpoint. The UI persona remains an *advisory* selector. The backend `CommandGateway` rejects a
command the bearer's identity is not authorised for (403). Therefore: **log in with the dev account whose role
matches the screen you are testing** (table in Appendix A). Auto-discovering roles from the bearer is a backend
gap — note it, do not fake it.

---

## PHASE 0 — Environment: backend up, seed, and same-origin proxy

Goal: a running backend, known seed ids/accounts, and a browser that can reach it without CORS errors.

### Step 0.1 — Start the backend with dev seed data
- **Do (manual, ask the user to run — interactive):**
  ```bash
  # in fintech-platform-backend/
  docker compose up -d            # Postgres (see docker-compose.yml)
  ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
  ```
  The `dev` profile activates `DevDataSeeder` (seeds 6 admins + one active supplier/buyer/investor + ack user +
  pricing band) and `DevController` (`/dev/last-otp`, `/dev/seed-info`).
- **Backend contract:** API port `8080`, base path `/api/v1`. Management/health on port `8081`
  (`GET http://localhost:8081/actuator/health`). Seeded admin password: `DevPass123!`.
- **Test:**
  ```bash
  curl -s http://localhost:8080/api/v1/dev/seed-info | jq
  # → { "supplier_id":"…","buyer_id":"…","investor_id":"…","admins_password":"DevPass123!" }
  ```
- **Acceptance:** `/dev/seed-info` returns non-null supplier/buyer/investor ids. Record them; they are the ids
  the UI will read/act on during testing.

> ⚠️ This step is environmental and may be run by the user. The Claude session must **not** assume the backend
> is up for build/test steps that don't need it; steps that need a live backend say **[needs backend]**.

### Step 0.2 — Vite dev proxy (solves CORS without touching the backend)
- **Why:** the backend has **no CORS config** (`SecurityConfig` does not enable `.cors()`), so a browser on
  `http://localhost:5173` calling `http://localhost:8080` is blocked by the browser. The UI-side fix is a dev
  proxy so the browser only ever calls its **own** origin (`/api/...`), which Vite forwards to `:8080`.
  This keeps the backend unchanged (source-of-truth-preserving).
- **Files:** `vite.config.js`
- **Do:** add a `server.proxy` entry:
  ```js
  export default defineConfig({
    plugins: [react()],
    server: {
      proxy: {
        '/api': { target: 'http://localhost:8080', changeOrigin: true },
      },
    },
  })
  ```
  All UI calls use **relative** paths beginning `/api/v1/...`. Do not hardcode `http://localhost:8080` anywhere
  in app code.
- **Test [needs backend]:** with `npm run dev` running, in the browser console on `localhost:5173`:
  ```js
  await fetch('/api/v1/dev/seed-info').then(r => r.json())
  ```
  returns the seed ids (no CORS error in the console).
- **Acceptance:** the fetch above succeeds through the proxy; no `Access-Control-Allow-Origin` error.
- **Alternative (only if the user wants prod-like direct calls):** enable CORS on the backend
  (`http.cors(...)` + a `CorsConfigurationSource` allowing the UI origin). This is a **backend change** — do it
  only on the user's instruction, in the backend repo, following its conventions. The proxy is the default.

### Step 0.3 — Runtime config + the DATA_MODE switch
- **Files:** new `src/config.js`; new `.env.development` (gitignored already via `.env*`); update `.env.example`
  (create it, committed).
- **Do:**
  - `src/config.js` exports:
    ```js
    export const API_BASE = '/api/v1'                      // always relative → proxy handles origin
    export const DATA_MODE = import.meta.env.VITE_DATA_MODE ?? 'mock'  // 'mock' | 'live'
    export const IS_LIVE = DATA_MODE === 'live'
    export const IS_DEV_BACKEND = (import.meta.env.VITE_DEV_BACKEND ?? 'true') === 'true' // enables /dev/last-otp OTP peek
    ```
  - `.env.example` documents `VITE_DATA_MODE=mock|live` and `VITE_DEV_BACKEND=true|false`.
- **Contract:** `DATA_MODE=mock` (default) → screens read `mockData.js` exactly as today. `DATA_MODE=live` →
  screens use the API layer, falling back to mock only for the documented read gaps.
- **Test:** `npm run build` green. `import.meta.env.VITE_DATA_MODE` resolves.
- **Acceptance:** with no `.env`, app behaves exactly as today (mock). Setting `VITE_DATA_MODE=live` flips the
  switch (no behavior wired yet — just the flag exists).

---

## PHASE 1 — API client core (transport layer)

Goal: one place that knows the base URL, the bearer, the command envelope headers, and the error shape.

### Step 1.1 — `request()` core wrapper
- **Files:** new `src/api/client.js`
- **Do:** implement a low-level `request(method, path, { body, bearer, commandId, aggregateVersion, raw,
  contentType })`:
  - URL = `API_BASE + path`.
  - Headers: `Authorization: Bearer <bearer>` when a bearer is set; `Content-Type: application/json` for JSON
    bodies (override with `contentType` for raw uploads); `X-Command-Id` when `commandId` given;
    `X-Aggregate-Version` when `aggregateVersion != null`.
  - Body: `JSON.stringify(body)` unless `raw` (then send the raw `Blob`/`ArrayBuffer`).
  - Parse: if response `content-type` is JSON → parse; if `raw`/binary requested → return `Blob`/`ArrayBuffer`.
  - On `!res.ok`: parse the error envelope and `throw new ApiError(...)` (Step 1.3).
  - Return `{ status, data, headers }`.
- **Backend contract:** JSON everywhere except document upload (`application/pdf` raw body) and document/Form-16A
  download (binary). 201 = created command, 200 = replayed/idempotent — both carry the same envelope; treat
  both as success.
- **Test:** temporary node/browser snippet: `request('GET','/dev/seed-info')` returns the seed ids **[needs backend]**;
  offline, unit-check that headers are assembled correctly (log them).
- **Acceptance:** a GET and a POST (with a fake command id) produce correctly-shaped requests; JSON and binary
  both parse.

### Step 1.2 — command envelope + id helpers
- **Files:** new `src/api/envelope.js`
- **Do:**
  - `newCommandId()` → `crypto.randomUUID()`.
  - `postCommand(path, body, { bearer, aggregateVersion })` → wraps `request('POST', …, {commandId:
    newCommandId(), aggregateVersion, body, bearer})`; returns the envelope `{ aggregate_id, aggregate_version,
    emitted_events, correlation_id }`.
  - `putCommand(...)` analogous for the two PUT commands (invoice-doc replace, kyc-doc replace).
  - `readById(path, bearer)` → `request('GET', …)`.
- **Contract:** callers **must** thread `aggregate_version`: read it from the last envelope or a fresh
  `readById`, pass it to the next transition on that aggregate. Creation commands (`/create`, `/nominate`,
  `/sign-up`, `/listings`, `/subscriptions/commit`, `/documents`, `/*/draft`, `/assignment-set/request`,
  `form-16a/issue`) take **no** `X-Aggregate-Version` — see `API_ALIGNMENT.md §2` per endpoint.
- **Test:** call a creation command then a transition on the seeded supplier **[needs backend]** and confirm the
  version increments 1→2→3.
- **Acceptance:** version flows correctly; a stale version yields the backend's optimistic-lock error (verify in
  Step 1.3).

### Step 1.3 — `ApiError` + error envelope
- **Files:** `src/api/client.js` (add `ApiError` class), new `src/api/errors.js` (helpers).
- **Do:** `ApiError` carries `{ status, error_code, error_category, message, violating_rule,
  violating_invariant_id, correlation_id, retryable }`. Provide `isConflict(e)` (409 / version), `isForbidden(e)`
  (403 role), `isValidation(e)` (400). A small `describe(e)` → user-facing string.
- **Backend contract (error body):**
  ```json
  { "error_code":"…","error_category":"…","violating_rule":null,"violating_invariant_id":null,
    "message":"…","status":409,"correlation_id":"…","retryable":false }
  ```
- **Test [needs backend]:** send a command with a wrong `X-Aggregate-Version` → catch an `ApiError` with the
  409/optimistic-lock shape; send a command as the wrong role → 403.
- **Acceptance:** all three error classes are distinguishable and expose `message` + `correlation_id`.

---

## PHASE 2 — Auth & session (the login flow)

Goal: real OTP login, a stored bearer, and screens that can call authenticated endpoints.

### Step 2.1 — auth service
- **Files:** new `src/api/services/auth.js`
- **Do:**
  - `loginPassword(email, password)` → `POST /auth/login/password` → `{ challenge_id }`.
  - `verifyOtp(challengeId, code)` → `POST /auth/login/verify-otp` → `{ bearer }`.
  - `devLastOtp(email)` → `GET /dev/last-otp?email=` → `{ email, code }` — **only** callable when
    `IS_DEV_BACKEND`; used to auto-fill the OTP in dev so login is one click.
- **Backend contract:** all three are 🔓 open (no bearer). OTP is SMS in real life; in dev the stub "sends" it
  and `/dev/last-otp` reads it back.
- **Test [needs backend]:** `loginPassword('ops@dev.local','DevPass123!')` → challenge_id; `devLastOtp` → code;
  `verifyOtp` → bearer (a UUID).
- **Acceptance:** full three-call sequence yields a usable bearer.

### Step 2.2 — AuthContext (session state)
- **Files:** new `src/context/AuthContext.jsx`; wrap it in `src/App.jsx` **outside** `PersonaProvider`.
- **Do:** hold `{ bearer, email, loginStep, challengeId }`. Actions: `beginLogin(email,password)`,
  `completeLogin(code)`, `logout()`. Persist `bearer`+`email` to `sessionStorage` (survives refresh, dies on tab
  close — acceptable for a UI). Expose `useAuth()`. The API layer reads the bearer from here (inject via a
  `setActiveBearer()` the client reads, or pass explicitly from services — prefer a module-level
  `getBearer()`/`setBearer()` in `client.js` set by AuthContext on change).
- **Contract:** in `mock` mode, AuthContext is a no-op shim (S1 can still call `onLogin` as today). In `live`
  mode it drives the real flow. Never block the mock path.
- **Test:** build green; in live mode, `useAuth().bearer` is set after login and cleared after logout.
- **Acceptance:** bearer persists across a page refresh in live mode; logout clears it.

### Step 2.3 — Wire S1 login to the real flow
- **Files:** `src/features/admin/S1.jsx`, `src/App.jsx` (`handleLogin`), `src/routes.js`
  (`LOGIN_PERSONA_MAP` — extend to the 6 dev accounts).
- **Do (live mode only; keep the mock variant switcher intact for `mock` mode):**
  - Step `credentials`: real Email + Password inputs (default to `ops@dev.local` / `DevPass123!` in dev). On
    Login → `beginLogin` → on success go to `mfa` step.
  - Step `mfa`: if `IS_DEV_BACKEND`, auto-fetch the OTP via `devLastOtp(email)` and pre-fill it (show a
    "dev OTP" hint); else the user types the SMS code. On Verify → `completeLogin(code)` → store bearer.
  - Replace the "Login as (mock only)" persona dropdown in live mode with a **role hint** derived from the
    email (Appendix A map) — the UI persona is advisory (backend enforces). Still call `setPersonaById` so nav +
    sidebar scope work, then navigate to the persona's first screen (existing `handleLogin` logic).
  - `mfa_failed` / `account_disabled` variants remain mock-only previews.
- **Backend contract:** see Step 2.1. A disabled admin or bad password yields an `ApiError` — surface it inline
  where the UI currently shows the red MFA error.
- **Test [needs backend]:** log in as each of the 6 dev accounts; land on the correct first screen; a protected
  `GET /suppliers/{seeded}` succeeds with the stored bearer; a bad password shows an inline error.
- **Acceptance:** real login works end-to-end for all 6 roles in live mode; mock mode login is unchanged.

---

## PHASE 3 — Service layer (one module per bounded context)

Goal: a thin, complete function-per-endpoint layer so wiring a screen is a one-liner. **Every function's
request/response shape must match `API_ALIGNMENT.md` / the controller exactly.** Build these before wiring
screens; each is trivially testable against the seed.

For each module under `src/api/services/`, implement the endpoints listed in `API_ALIGNMENT.md §2`. Signatures
below are the contract (all return the envelope unless noted; all reads return the documented GET shape).

### Step 3.1 — `suppliers.js` (BC8)
`create({legal_name,constitution_type,pan,gstin,cin})` · `grantAgencyConsent(id, {scope}, v)` ·
`recordIdentityVerified(id, v)` · `submitKyc(id, v)` · `recordKycApproved(id, v)` · `recordKycRejected(id,
{reason}, v)` · `resubmitKyc(id, v)` · `submitFinancialProfile(id, {top_buyers?}, v)` · `recordCreditReview(id,
{exposure_cap_paise,risk_rating}, v)` · `recordMaaSigned(id, v)` · `activate(id, v)` · `get(id)` →
`{supplier_id,status,aggregate_version}`.
- **Test [needs backend]:** drive the seeded supplier (already `active`) read; create a fresh supplier and walk
  `created → … → active`, threading version.
- **Acceptance:** each command returns an incremented version; `get` reflects the new status.

### Step 3.2 — `buyers.js` (BC9)
`nominate({legal_name,mca_cin,gstin,sector})` · `recordIdentityVerified(id,v)` ·
`recordCreditAssessment(id,{credit_limit_paise},v)` · `startEngagement(id,v)` · `designateAckUser(id,
{email,phone,display_name},v)` · `confirmPaymentInstruction(id,v)` · `activate(id,v)` ·
`kybVerification(id,{verified:true,document_id?},v)` · `get(id)` · `getKyb(id)` →
`{kyb_verified,kyb_verified_by,kyb_verified_at,kyb_document_id}`.

### Step 3.3 — `investors.js` (BC7)
`issueInvite({email,phone})` (path `/investor-invites/issue`) · `signUp({invite_id,email,phone,sub_type})` ·
`recordIdentityVerified(id,{pan,aadhaar_last4},v)` · `submitKyc(id,v)` · `assessSuitability(id,{mismatch?},v)` ·
`acknowledgeSuitabilityOverride(id,{override_text},v)` · `completeFinancialProfile(id,{bank_account_last4},v)` ·
`recordKycApproved(id,v)` · `recordKycRejected(id,{reason},v)` · `resubmitKyc(id,v)` · `recordMiaSigned(id,v)` ·
`activate(id,v)` · `get(id)`.

### Step 3.4 — `listings.js` (BC1) + ops-checks
`create({supplier_id,buyer_id,invoice_number,face_value_paise,invoice_date,tenor_days,irn?})` ·
`startOpsChecks(id,v)` · `recordOpsCheck(id,{check_name,outcome?},v)` · `completeOpsChecks(id,v)` ·
`requestBuyerAck(id,{sla_hours},v)` · `recordBuyerAck(id,{outcome,method?,evidence_ref?},v)` ·
`snapshotAndReady(id,{rate_bps},v)` · `approveGoLive(id,v)` · `declareFundingShortfall(id,v)` · `get(id)` →
`{listing_id,status,funding_target,va_id,aggregate_version}`.
- **Note:** `check_name` uses the canonical values `irn_validity, eway_bill_match,
  buyer_supplier_relationship, duplicate_check, supplier_exposure_cap, buyer_limit_headroom,
  document_completeness` (already fixed in `mockData.js`). `outcome` is `passed` (or omit for vendor checks).

### Step 3.5 — `subscriptions.js` (BC2)
`commit(listingId,{investor_id,amount_paise})` · `cancel(subId,v)` · `recordRefund(subId,v)` ·
`get(listingId,subId)` → `{subscription_id,status,amount,aggregate_version}`.

### Step 3.6 — `assignment.js` (BC5)
`request(listingId)` · `completeSigning(listingId,{investor_id})` · `declareIncomplete(listingId)` ·
`recordLegFailed(listingId,{investor_id,reason})` · `reinitiateLeg(listingId,{investor_id})` · `get(listingId)`
→ `{assignment_set_id,status,signed_count,total_count,all_signed}`.

### Step 3.7 — `settlement.js` (BC4)
`disbursementDraft(listingId)` · `disbursementApprove(listingId)` · `getDisbursement(listingId)` →
`{payout_instruction_id,status,gross_amount,listing_status}` · `recordMaturity(listingId,{amount_paise,utr})`.

### Step 3.8 — `distributionTax.js` (BC12)
`distributionDraft(listingId)` · `distributionApprove(listingId)` · `getDistribution(listingId)` →
`{payout_instruction_id,status,gross_amount,net_amount,total_tds_amount,listing_status,terminal_outcome}` ·
`issueForm16a(investorId,fyCode)` · `getForm16a(investorId,fyCode)` (binary) ·
`deductions(investorId,{fy?})` → `[{listing_id,fy_code,gross_paise,tds_amount_paise,fee_paise,net_paise,challan_ref}]` ·
`statements(investorId)` → `[{period,kind,generated_at,doc_hash}]`.

### Step 3.9 — `credit.js` (BC3)
`pricingBand({buyer_id,tenor_bucket,rate_range_min_bps,rate_range_max_bps,fee_bps,effective_from?})` ·
`buyerProfile(id,{sector,rating_source,rating,credit_limit_paise,tenor_cap_days})` ·
`supplierProfile(id,{risk_rating,exposure_cap_paise})`.

### Step 3.10 — `adminUsers.js` (Admin IAM)
`provision({email,display_name,phone})` · `assignRole(id,{role,override_reason?})` · `revokeRole(id,role)` ·
`disable(id,v)` · `get(id)`.

- **Phase 3 Test [needs backend]:** a scratch script (or browser console) exercising one call per module against
  the seed. **Phase 3 Acceptance:** every module function hits its endpoint and returns the documented shape;
  no shape guessing — cross-checked against the controller.

---

## PHASE 4 — Documents, KYC docs & invoice artifacts (BC16 / BC11 / BC1)

Goal: real file upload + attach + download. This is the piece the UI has never had. **Read the three
controllers** (`DocumentController`, `KycDocumentController`, `InvoiceDocumentController`) before implementing.

### Step 4.1 — `documents.js` (BC16 generic two-phase upload)
- **Files:** new `src/api/services/documents.js`
- **Do:** implement the three-phase primitive and one convenience wrapper:
  - `initiate({kind, content_type, declared_size})` → `POST /documents` (command; `X-Command-Id`;
    `document_id` derives from the command id, so it is **idempotent**) → `{ document_id, upload_url }`.
  - `uploadContent(documentId, blob)` → `PUT /documents/{id}/content` with the **raw** body and
    `Content-Type: application/pdf`. **Not a command** — no `X-Command-Id`, no `X-Aggregate-Version`; just the
    bearer. Respects the 20 MB cap (`documents.max-upload-bytes`) → 413/size error to surface.
    Prefer the returned `upload_url` if present; otherwise use the canonical `/documents/{id}/content` path.
  - `finalize(documentId)` → `POST /documents/{id}/finalize` → `{document_id,kind,status,content_type,byte_size}`
    (`status` becomes `stored`; SHA-256 hashed server-side; idempotent).
  - `get(documentId)` → `GET /documents/{id}` (metadata, no bytes).
  - `downloadContent(documentId)` → `GET /documents/{id}/content` (binary Blob).
  - **Wrapper** `uploadPdf(file, kind)` = initiate → uploadContent → finalize, returning the `stored`
    `document_id`. Guard: `file.type === 'application/pdf'`, size ≤ cap.
- **Backend contract:** `sys_document_status`: `pending_upload → stored → failed`. Upload/finalize are
  operational plumbing (any authenticated admin; no role/MFA). The **five non-negotiables** live on the
  *consumer* attach command (Steps 4.2–4.3), not here.
- **Test [needs backend]:** `uploadPdf(<small pdf blob>, 'invoice')` → a `document_id` whose `get` shows
  `status:"stored"`, correct `content_type`/`byte_size`; `downloadContent` returns the same bytes.
- **Acceptance:** round-trip upload→finalize→download of a real PDF works; oversize and non-PDF are rejected with
  a clear error.

### Step 4.2 — Invoice artifacts (BC1) — `invoiceDocuments.js`
- **Files:** new `src/api/services/invoiceDocuments.js`
- **Do:** `attach(listingId,{document_id})` → `POST /listings/{id}/invoice-documents` (command; `X-Command-Id`;
  **no** version header) · `replace(listingId,documentId,{new_document_id})` → `PUT …/{documentId}` ·
  `list(listingId)` → `[{document_id,status,kind,content_type,byte_size,document_status}]` ·
  `downloadContent(listingId,documentId)` → binary.
- **Backend contract:** the attached document must be **PDF + `stored`**; recorder ≠ uploader; attach is rejected
  after `ready_for_review` (freezes at snapshot); it gates the `document_completeness` ops-check. Download is
  gated on a live-set listing status.
- **Test [needs backend]:** on a listing in ops-checks: `uploadPdf` → `attach` → `list` shows it `active` →
  the `document_completeness` ops-check can be recorded → `downloadContent` returns the PDF.
- **Acceptance:** attach→list→download works; attaching after snapshot is rejected as the backend dictates.

### Step 4.3 — Onboarding KYC docs (BC11) — `kycDocuments.js`
- **Files:** new `src/api/services/kycDocuments.js`
- **Do:** `attach(kycFileId,{document_id,doc_kind})` → `POST /kyc/{kycFileId}/documents` · `replace(kycFileId,
  kycDocumentId,{new_document_id})` → PUT · `list(kycFileId)` →
  `[{kyc_document_id,document_id,doc_kind,status}]` · `coverage(kycFileId)` → `{ <doc_kind>: bool }` ·
  `requirements(subject_type)` → `GET /onboarding-doc-requirements?subject_type=` ·
  `upsertRequirement({subject_type,doc_kind,active})` → POST.
- **Backend contract:** `doc_kind ∈ kyc_doc_kind` (`pan_card, address_proof, gst_certificate,
  certificate_of_incorporation, board_resolution, moa_aoa, bank_statement, cancelled_cheque, photograph,
  other`). Capture-only, advisory — **nothing is mandatory, coverage is advisory, gates nothing.** One active
  doc per kind. `subject_type ∈ {investor, supplier}`. **You need a `kycFileId`** — *resolved:* one
  `comp_kyc_file` exists per subject (UNIQUE `subject_id`+`subject_type`) but **no endpoint exposes its id yet**.
  The backend must add a resolver (`GET /suppliers/{id}/kyc-file` / `GET /investors/{id}/kyc-file` — backend
  spec **BE-2**). Until BE-2 ships, the KYC-doc UI is **backend-blocked**: gate it behind BE-2, do not invent an
  id. The `kyc_file_id` exists only after KYC is *submitted*.
- **Test [needs backend]:** attach a `pan_card` doc to a known kyc file → `list` shows it `active` →
  `coverage` flips that kind to `true`.
- **Acceptance:** attach + coverage reflect reality; requirements list loads.

### Step 4.4 — Buyer KYB doc (BC9)
- **Do:** already covered by `buyers.kybVerification(id,{verified:true,document_id?},v)` (Step 3.2). The optional
  `document_id` comes from `documents.uploadPdf`. `getKyb(id)` reads it back.
- **Test [needs backend]:** `uploadPdf` a KYB doc → `kybVerification(id,{verified:true,document_id})` →
  `getKyb(id)` returns `kyb_verified:true` + the `kyb_document_id`.
- **Acceptance:** KYB attestation with an attached doc round-trips.

### Step 4.5 — UI surfaces for documents
- **Where:** S5/S12 (invoice PDF: upload on S5 ops flow, view/download on S5 + investor S12); S3 (supplier KYC
  docs, if a kycFileId is obtainable — else flag blocked); S10 (investor KYC docs, same caveat); S4 (buyer KYB
  doc upload + status).
- **Do:** add minimal upload (`<input type=file accept=application/pdf>`) + a "Download PDF" link using the
  services above, inside existing Cards — no new component files. In `mock` mode these controls are disabled/
  hidden or show a mock filename.
- **Acceptance:** in live mode, an ops user can upload+attach an invoice PDF on S5 and an investor can download
  it on S12; buyer KYB doc uploads on S4.

---

## PHASE 5 — Screen wiring (incremental, per screen)

Goal: switch each screen's **commands and by-id reads** to live in `live` mode; keep the **gap reads** on mock
with a visible "mock data — no backend read endpoint (Gx)" marker. Every screen keeps working in `mock` mode.

**The universal wiring pattern (apply to every command action):**
1. Read the current `aggregate_version` (from state seeded by the last read, or a fresh `services.X.get(id)`).
2. Call the command with that version.
3. On success: take `aggregate_version` from the returned envelope, then `services.X.get(id)` to refresh the
   displayed `status`/fields; update local state.
4. On `ApiError`: show it inline (409 → "changed since you loaded, refreshing" + auto re-read; 403 → "your role
   can't do this — log in as <role>"; 400 → the validation message).

Do the screens in this order (dependency + value). Each is one step with its own **Test [needs backend]**.

### Step 5.1 — S1 login — **done in Phase 2.**

### Step 5.2 — S3 Supplier onboarding
- Live: the onboarding actions map to `suppliers.*` (create, identity, submit/approve/reject/resubmit KYC,
  financial profile, credit review, MAA, activate) with the version pattern; status badge reads
  `suppliers.get`. Read `supplier_id` to act on from the seed or a freshly created one.
- Mock (gap G2): the **supplier list** + display fields (name/pan/gstin/consent/timestamps) stay mock — flag it.
- **Test:** create a supplier, walk it to `active`, watch the status badge follow each command.
- **Acceptance:** full supplier lifecycle drives the real aggregate; list remains mock-flagged.

### Step 5.3 — S4 Buyer management + credit
- Live: `buyers.*` lifecycle (nominate → identity → credit-assessment → engagement → activate),
  `buyers.kybVerification`, `credit.pricingBand`, `credit.buyerProfile`. Status via `buyers.get`/`getKyb`.
- Mock (gap G3): buyer list + pricing-band list display.
- **Test:** nominate a buyer, assess credit (`credit_limit_paise`), activate; set a pricing band; do KYB with a
  doc (Step 4.4).
- **Acceptance:** buyer lifecycle + KYB + pricing band are live; lists mock-flagged.

### Step 5.4 — S5 Invoice checks + listing approval + invoice PDF
- Live: `listings.create → startOpsChecks → recordOpsCheck×N → completeOpsChecks → requestBuyerAck →
  recordBuyerAck → snapshotAndReady({rate_bps}) → approveGoLive`; invoice PDF via Phase 4.2; status via
  `listings.get`. **Maker-checker:** `approveGoLive` requires the `treasury_and_settlement` bearer and
  checker ≠ maker — test with two logins.
- Mock (gap G4): the invoice/listing **lists** + supplier/buyer names.
- **Test:** create a listing, record all ops-checks, attach the invoice PDF (gates
  `document_completeness`), snapshot with a rate, then approve-go-live **as treasury** → status `live`, a
  `va_id` appears.
- **Acceptance:** the full listing spine to `live` runs against the backend; go-live enforces the treasury role.

### Step 5.5 — S6 Disbursement queue (maker-checker)
- Live: `settlement.disbursementDraft` (maker, treasury) → `settlement.disbursementApprove` (checker,
  **treasury2**, ≠ maker) → status `disbursed`; read `settlement.getDisbursement`.
- Mock (gap G5): the queue **list**, net amount, maker/checker names, UTR.
- **Test [needs backend]:** on a funded+assigned listing, draft as `treasury@dev.local`, approve as
  `treasury2@dev.local`; a same-user approve must be rejected.
- **Acceptance:** maker-checker disbursement works with two sessions; single-session approve is refused.

### Step 5.6 — S7 Distribution + reconciliation + maturity
- Live: `settlement.recordMaturity({amount_paise,utr})` → `distributionTax.distributionDraft` →
  `distributionApprove` (treasury maker-checker) → deal `distributed`; read `getDistribution`.
- Mock (gap G6): the **per-investor** distribution breakdown table and **reconciliation** entirely.
- **Test:** record maturity, draft+approve distribution across two treasury logins; totals
  (gross/net/total_tds) come from `getDistribution`.
- **Acceptance:** distribution closes the deal live; per-investor table + reconciliation stay mock-flagged.

### Step 5.7 — S8 Investor invites
- Live: `investors.issueInvite({email,phone})` (compliance role). Mock (gap G7): the invite **list**;
  `issued_by`/`justification` are UI-only.
- **Test:** issue an invite as `compliance@dev.local` → envelope returns; capture `aggregate_id` as the
  invite id for a later sign-up.
- **Acceptance:** invite issuance is live; list mock-flagged.

### Step 5.8 — S10 Investor onboarding
- Live: `investors.signUp({invite_id,email,phone,sub_type}) → recordIdentityVerified({pan,aadhaar_last4}) →
  submitKyc → assessSuitability → (acknowledgeSuitabilityOverride) → completeFinancialProfile({bank_account_last4})
  → recordKycApproved → recordMiaSigned → activate`; status via `investors.get`. KYC docs via Step 4.3 (if
  kycFileId obtainable). `sub_type ∈ {resident_individual, huf}` for Phase 1.
- **Test:** use an invite id from Step 5.7; walk the investor to `active`.
- **Acceptance:** investor lifecycle is live end-to-end.

### Step 5.9 — S11 marketplace + S12 detail/subscribe
- Live: subscribe via `subscriptions.commit(listingId,{investor_id,amount_paise})`; S12 detail read via
  `listings.get`; invoice PDF download via Step 4.2.
- Mock (gaps G9/G10): the **marketplace list** (S11) and the rich detail (pricing snapshot, committed total,
  VA number/IFSC, invoice/buyer/supplier fields) on S12.
- **Test:** on a `live` listing, commit a subscription for the seeded investor; `subscriptions.get` shows
  `committed`.
- **Acceptance:** subscribe is live; list + rich detail mock-flagged.

### Step 5.10 — S13 portfolio + statements
- Live: `distributionTax.deductions`, `.statements`, `.issueForm16a`/`.getForm16a` (download).
- Mock (gap G11): the **positions/portfolio list** + summary tiles.
- **Test:** read the seeded investor's deductions/statements; issue+download a Form 16A for a FY (e.g.
  `FY2026-27`) as `compliance@dev.local`.
- **Acceptance:** tax reads + Form 16A are live; portfolio list mock-flagged.

### Step 5.11 — S14 supplier portal
- Live: `suppliers.get` for identity/status. Mock (gap G12): the per-supplier **invoice/listing tracker**.
- **Backend truth:** supplier **self-service create is not built** — listings are ops-created. The S14 "upload
  IRN / submit invoice" affordance must be shown as **not-yet-supported** in live mode (or routed through the
  admin flow), not faked.
- **Acceptance:** S14 shows live supplier status; tracker mock-flagged; self-create clearly disabled in live.

### Step 5.12 — S15 buyer portal
- Live: OTP login for the **ack user** (`ack@dev.local`). *Resolved:* the ack-user login is a **passwordless
  email+OTP** path that **does not exist yet** — it is deferred backend work (**WS-2**, backend spec **BE-15**),
  and it is **not** the admin `/auth/login/password` flow (ack users have no password credential). So S15 login
  is **backend-blocked** until BE-15/WS-2 ships; keep S15 on the mock OTP flow in live mode until then.
- Mock (gap G13): buyer-facing **invoice list**, **payment instruction**, **NOA**, and **self-ack** — there is
  no buyer-facing read or self-ack endpoint; buyer ack is recorded admin-side (`listings.recordBuyerAck`).
- **Acceptance:** ack-user OTP login is live if supported; all buyer reads + self-ack stay mock-flagged with the
  G13 note; the plan explicitly records the missing buyer-facing endpoints as backend backlog.

---

## PHASE 6 — Cross-cutting hardening

### Step 6.1 — Loading / error / empty states
Every live call gets a pending state (disable the button, show a spinner) and an error surface (inline, using
`ApiError.message` + `correlation_id`). No silent failures.
- **Acceptance:** slow/failed calls never leave the UI in a lying state.

### Step 6.2 — Optimistic-concurrency UX
On 409/version conflict: auto re-read the aggregate, show "reloaded — please retry", and update the cached
version. Never let the user hammer a stale version.
- **Acceptance:** a deliberately stale command recovers gracefully.

### Step 6.3 — Idempotency & double-submit
Command ids are generated per click; a retry of the *same* logical action should reuse behaviour safely
(backend is idempotent on `X-Command-Id`). Guard against double-submit (disable while pending). Decide per
action whether a retry reuses the id (true idempotent retry) or mints a new one (fresh attempt) — default:
new id per user-initiated click, reuse on an automatic network retry.
- **Acceptance:** double-clicks don't create duplicates.

### Step 6.4 — MFA-fresh / sensitive commands
Some commands are MFA-fresh server-side. Keep the existing `MfaModal` as the UI gate on sensitive actions
(go-live, disbursement approve, distribution approve). If the backend rejects for stale MFA, surface it and
route the user to re-auth. *Resolved:* **every admin command requires MFA freshness** (all `SENSITIVE`, 5-min
window) — so gate **all** admin commands with `MfaModal`, not just go-live/disbursement. Non-admin actors skip.
- **Acceptance:** sensitive actions show the MFA gate and handle a stale-MFA rejection.

### Step 6.5 — Persona ⇄ role reconciliation
Because the UI can't discover the bearer's roles, when a command 403s, tell the user which dev account/role is
needed (Appendix A). Optionally show the logged-in email in the TopBar.
- **Acceptance:** role mismatches produce an actionable message, not a raw 403.

---

## PHASE 7 — Verification: golden-path E2E

### Step 7.1 — Reproduce `manual-test.http` through the UI
Drive the full money spine **through the live UI** in this order, mirroring
`fintech-platform-backend/manual-test.http`: login (ops, treasury, treasury2) → create listing → ops-checks →
buyer ack → snapshot → go-live → subscribe → (inflow webhook via `scripts/dev-smoke.sh`, out of UI scope) →
assignment → disburse (maker-checker) → maturity → distribution → Form 16A.
- **Acceptance:** the listing reaches `distributed`/`closed` driven from the UI; every status transition
  observed in the UI matches a `GET` from the backend. Any step that can't be driven from the UI (e.g. the
  HMAC inflow webhook) is documented as out-of-UI-scope with the script to run instead.

### Step 7.2 — Verification matrix
Produce a short table: **screen × action × {live|mock} × tested?** Confirm every ✅/⚠️ endpoint in
`API_ALIGNMENT.md §2` is wired, and every ❌ gap is mock-flagged in the UI. Update `API_ALIGNMENT.md §4` if any
gap was closed by a backend change during integration.
- **Acceptance:** matrix complete; no endpoint silently unwired; no gap silently faked.

---

## Appendix A — Seeded dev accounts (from `DevDataSeeder`)

Password for all admins: **`DevPass123!`**. OTP peek (dev): `GET /api/v1/dev/last-otp?email=<email>`.
**Canonical role⇄persona mapping (incl. the 5 UI personas NOT live-mapped): `API_ALIGNMENT.md §1.4`.**

| Email | Backend role | UI persona (live) | Use for screens |
|---|---|---|---|
| `super@dev.local` | `super_admin` | `super-admin` | S2, admin-user provisioning |
| `ops@dev.local` | `ops_executive` | `ops-executive` | S3, S5 (maker), S7 maturity, S8 sign-up, subscribe |
| `credit@dev.local` | `credit_reviewer` | `credit-reviewer` | S4 (credit), S5 supplier/buyer profiles |
| `compliance@dev.local` | `compliance_reviewer` | `compliance-reviewer` | S8 invite issue, KYC approve/reject, Form 16A issue |
| `treasury@dev.local` | `treasury_and_settlement` | `treasury-settlement` | S5 go-live, S6 draft (maker), S7 distribution (maker) |
| `treasury2@dev.local` | `treasury_and_settlement` | `treasury-settlement` | S6 approve, S7 distribution (checker ≠ maker) |
| `ack@dev.local` | buyer ack user (OTP-only) | — (buyer portal, WS-2) | S15 |
| `investor@dev.local` | investor identity | — (investor context, M10-full) | S10–S13 |

The UI's composite `ops-treasury` persona has **no** live account (its steps split across `ops@` and
`treasury@`/`treasury2@`); `auditor`/`investor`/`supplier`/`buyer` are not live-mapped this phase — see §1.4.

Seed counterparty ids: `GET /api/v1/dev/seed-info` → `{supplier_id, buyer_id, investor_id, admins_password}`.

## Appendix B — File plan (new/changed)

```
src/config.js                       # NEW  API_BASE, DATA_MODE, IS_LIVE, IS_DEV_BACKEND
src/api/client.js                   # NEW  request(), ApiError, get/setBearer
src/api/envelope.js                 # NEW  newCommandId, postCommand/putCommand, readById
src/api/errors.js                   # NEW  isConflict/isForbidden/isValidation, describe
src/api/services/auth.js            # NEW  loginPassword, verifyOtp, devLastOtp
src/api/services/{suppliers,buyers,investors,listings,subscriptions,
                  assignment,settlement,distributionTax,credit,adminUsers,
                  documents,invoiceDocuments,kycDocuments}.js   # NEW (Phases 3–4)
src/context/AuthContext.jsx         # NEW  bearer/session state
src/App.jsx                         # EDIT wrap AuthProvider; handleLogin live path
src/routes.js                       # EDIT LOGIN_PERSONA_MAP → 6 dev accounts
vite.config.js                      # EDIT dev proxy
.env.example                        # NEW  VITE_DATA_MODE, VITE_DEV_BACKEND
src/features/**/S*.jsx              # EDIT per Phase 5 (live wiring behind IS_LIVE; mock path preserved)
```

## Appendix C — Invariants the implementing session must never break

1. **Backend is source of truth.** Match its shapes/enums/flows exactly; when unsure, read the controller.
2. **Mock never breaks.** `DATA_MODE=mock` (the default, backend down) must run the app exactly as today.
3. **Re-read after every command.** Envelopes aren't entities; refresh via `GET …/{id}` and thread the version.
4. **Never fake a gap.** Read-gap data (G1–G13) stays mock and stays visibly flagged; missing endpoints are
   backlog, not invention.
5. **Roles are server-enforced.** The UI persona is advisory; handle 403 with an actionable message.
6. **One step at a time.** Build green + step Test pass before the next step.
```
