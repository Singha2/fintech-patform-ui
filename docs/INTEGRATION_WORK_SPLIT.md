# Integration Work Split — Backend vs UI

> Divides the live-integration work into **Part A (backend, `fintech-platform-backend`)** and
> **Part B (UI, this repo)**. The detailed, step-wise UI build plan lives in
> [`INTEGRATION_PLAN.md`](INTEGRATION_PLAN.md); the endpoint↔screen mapping and the read-gap register (G1–G13)
> live in [`API_ALIGNMENT.md`](API_ALIGNMENT.md). This doc is the "who does what, in what order" index.
>
> **Source-of-truth rule still holds:** all shapes proposed for the backend below are **PROPOSALS**; the
> backend owns the final contract, and the UI must then adhere to whatever the backend ships.

---

## How the two parts relate (read this first)

1. **Part B (UI) can go fully live with ZERO backend changes** for everything the backend already exposes:
   the two-step OTP login, **all write commands**, and **all by-id reads**. CORS is solved UI-side with a Vite
   dev proxy (no backend edit). This is the whole of `INTEGRATION_PLAN.md` Phases 0–7 for the ✅/⚠️ endpoints.
2. **Part A (backend) is what lets the UI drop its "mock data" flags.** Every UI screen that today shows a list,
   dashboard, marketplace, portfolio, or buyer-facing read is blocked on a backend **read model** that does not
   exist yet (gaps G1–G13). Until each lands, that part of the screen stays on mock data, visibly flagged.
3. **Recommended sequence:** ship **Part B first** (command paths + by-id reads go live now), then land **Part A**
   items incrementally — each one removes exactly one mock-flag from the UI. The two teams/sessions can work in
   parallel against the contracts below.

**One-line summary:** Part B = "wire the UI to what exists." Part A = "build the read side (and role discovery)
so nothing has to stay mock."

---

# PART A — Backend changes (`fintech-platform-backend`)

> **Expanded into a standalone backend-repo spec:** `fintech-platform-backend/docs/UI_INTEGRATION_BACKEND_SPEC.md`
> (items **BE-1…BE-16**, with a design-invariants guardrail section). That spec confirms these are all
> **additive read endpoints** — they match the backend's native read pattern (thin `JdbcTemplate` over existing
> write tables), need **no migration** for P0/P1, change **no** command or existing by-id read, and map onto the
> backend's own ROADMAP (audit → **M17**, investor reads → **M10-full**, buyer login → **WS-2**). The
> summary below mirrors it.

None of these block a first live demo of the command spine; they remove mock-flags and improve UX. Priorities:
**P0** = needed for a coherent end-to-end live UI, **P1** = removes a major mock-flag, **P2** = prod / polish.

### A1 — Read models: list & query endpoints (closes G1–G13) — **P1**
Today every `GET` is fetch-one-by-id returning `{id, status, version}`. The UI needs list/query reads. Proposed
(backend finalizes shape; keep money in paise, rates in bps, statuses per the existing enums):

| Gap | Screen | Proposed endpoint (PROPOSAL) | Returns (proposal) |
|---|---|---|---|
| G2 | S3 | `GET /suppliers?status=&q=` | `[{supplier_id, legal_name, pan, gstin, constitution_type, status, activated_at}]` |
| G3 | S4 | `GET /buyers?status=&q=` · `GET /credit/buyers/{id}/pricing-bands` | buyer rows; `[{tenor_bucket, rate_range_min_bps, rate_range_max_bps, fee_bps, effective_from}]` |
| G4 | S5 | `GET /listings?status=&supplier_id=&buyer_id=` · `GET /listings/{id}/ops-checks` | listing rows w/ supplier/buyer names; `[{check_name, outcome, checked_by, checked_at}]` |
| G5 | S6 | `GET /listings/{id}/disbursement` **expanded** or `GET /disbursements?status=` | add `net_amount, maker, checker, utr, funding_completed_at` |
| G6 | S7 | `GET /listings/{id}/distribution/investors` · reconciliation read | `[{investor_id, name, gross_paise, tds_paise, fee_paise, net_paise, utr}]`; recon ledger |
| G7 | S8 | `GET /investor-invites?status=` | `[{invite_id, email, phone, status, issued_by, issued_at, expiry_at, consumed_at}]` |
| G9 | S11 | `GET /listings?status=live` (investor-visible) | marketplace rows: funding target, committed total, rate, tenor, due date |
| G10 | S12 | **expand** `GET /listings/{id}` | add `committed_total, pricing_snapshot{rate_bps,fee_bps,snapshot_at}, va_number, va_ifsc, invoice{…}, buyer{…}, supplier{…}` |
| G11 | S13 | `GET /investors/{id}/subscriptions` + summary | positions list + `{total_deployed, total_returned, active, matured}` |
| G12 | S14 | `GET /suppliers/{id}/listings` (or `/invoices`) | per-supplier invoice+listing tracker rows |

- **Rationale:** the UI screens are list/dashboard-shaped; by-id reads can't drive them.
- **Unblocks:** removes the mock-flag on S3, S4, S5, S6, S7, S11, S12, S13, S14.
- **Note on auth scope:** several reads are currently "any bearer" (no ownership scoping). Investor-facing reads
  (G9, G11) and buyer-facing (G13) will need **ownership/role scoping** when real (a KYC'd-investor gate is
  already noted as deferred in the catalogue).

### A2 — Current-identity / roles endpoint (role discovery) — **P0**
- **What:** `GET /auth/session` (or `/me`) → `{ identity_id, kind, email, roles: [admin_role], mfa_fresh_until }`.
- **Rationale:** login returns only an opaque bearer. The UI cannot tell which role the user has, so the persona
  selector is guesswork and 403s are opaque. This endpoint lets the UI show the real role, scope the sidebar,
  and pre-empt role-mismatched commands.
- **Unblocks:** UI persona ⇄ role reconciliation (removes the "advisory persona" workaround in
  `INTEGRATION_PLAN.md` Step 6.5 / Phase 2).

### A3 — Dashboard queues & stats (G1) — **P1**
- **What:** `GET /admin/work-queues?role=` → per-role pending-item lists; `GET /admin/stats` → the S2 tiles
  (active listings, total deployed paise, active investors/suppliers, pending disbursements).
- **Rationale:** S2 is entirely UI-composed today (no aggregation endpoint).
- **Unblocks:** S2.

### A4 — Buyer-facing endpoints + self-ack (G13) — **P1**
- **What:** buyer-ack-user-scoped reads — `GET /buyer/invoices` (ack list + statuses), `GET /buyer/payment-instruction`,
  `GET /listings/{id}/noa` (NOA download); and a **buyer self-ack** command
  `POST /listings/{id}/buyer-ack` (ack-user bearer) so ack isn't only admin-captured.
- **Confirm:** the exact **ack-user login path** (OTP-only). If it differs from admin `/auth/login/*`, document it.
- **Unblocks:** S15 (today entirely mock; buyer ack is admin-side only via `record-buyer-ack`).

### A5 — Supplier self-service (S14) — **P2**
- **What:** supplier-scoped invoice submission (supplier bearer) if suppliers should self-create listings/upload
  IRN. Today listings are **ops-created only**; supplier self-create is not built.
- **Rationale:** S14 has an "upload IRN / submit invoice" affordance with no backend path.
- **Unblocks:** the S14 submit flow (until then the UI must disable it in live mode).

### A6 — Audit query (G8) — **P2 · maps to the planned M17 Auditor module**
- **What:** `GET /audit/events?entity_type=&from=&to=&sensitivity=` → the S9 log, from `sys_audit_event`
  (commands are already audit-logged server-side; there is just no read API).
- **Design note:** this is the already-roadmapped **M17 Auditor (BC13)** module — build it there, not as an
  ad-hoc endpoint. Audit-as-projection is a noted post-pilot optimization.
- **Unblocks:** S9.

### A7 — Clarifications the backend must confirm (no build, just answers) — **P0**
1. **KYC file id:** how does the UI obtain the `kycFileId` needed for `POST /kyc/{kycFileId}/documents`? Expose
   it on the supplier/investor read, or document the derivation. (Blocks the KYC-doc UI in `INTEGRATION_PLAN.md`
   Step 4.3.)
2. **MFA-fresh commands:** *resolved* — **every admin-actor command requires MFA freshness** (all are
   `ActionSensitivity.SENSITIVE`, a 5-minute window; there is no per-command allowlist). So the UI must gate
   **all** admin commands with `MfaModal` (not just go-live/disbursement) and handle a stale-MFA rejection
   (Step 6.4). Non-admin-actor commands skip the gate.
3. **Ack-user login:** confirm the OTP-only login path for buyer ack users (A4).
4. **CORS/serving in prod:** see A8.

### A8 — CORS / serving (prod only) — **P2**
- **Dev:** no change — the UI uses a **Vite proxy** so the browser stays same-origin. `SecurityConfig` today does
  **not** enable `.cors()`.
- **Prod:** if the UI is served from a different origin than the API, either put both behind one reverse proxy
  (no CORS needed) **or** enable CORS on the backend (`http.cors(...)` + a `CorsConfigurationSource` allowlisting
  the UI origin). This is a backend/infra decision to make at deploy time.

---

# PART B — UI changes (this repo, `fintech-patform-mock`)

Full step detail is in [`INTEGRATION_PLAN.md`](INTEGRATION_PLAN.md). This is the checklist with backend
dependencies called out. Items marked **(no backend)** can be built and shipped now.

| # | UI work | Plan ref | Depends on | Notes |
|---|---|---|---|---|
| B0 | Vite proxy, `src/config.js`, `DATA_MODE` switch, `.env.example` | Phase 0 | **(no backend)** | mock stays default |
| B1 | `src/api/client.js` + envelope + `ApiError` | Phase 1 | **(no backend)** | transport layer |
| B2 | Auth service + `AuthContext` + wire S1 login | Phase 2 | **(no backend)** for login; **A2** to show real role | persona advisory until A2 |
| B3 | Service layer (one module per bounded context) | Phase 3 | **(no backend)** | commands + by-id reads |
| B4 | Documents: upload/finalize/attach/download (BC16/BC1/BC11) | Phase 4 | **(no backend)** for BC16+BC1; **A7.1** for KYC-doc | KYC-doc UI blocked on kycFileId |
| B5.2 | S3 supplier lifecycle live | Step 5.2 | **(no backend)** live; **A1/G2** for the list | list stays mock until G2 |
| B5.3 | S4 buyer lifecycle + credit + KYB live | Step 5.3 | **(no backend)** live; **A1/G3** for lists | lists mock until G3 |
| B5.4 | S5 listing spine + ops-checks + invoice PDF + go-live | Step 5.4 | **(no backend)** live; **A1/G4** for lists | lists mock until G4 |
| B5.5 | S6 disbursement maker-checker live | Step 5.5 | **(no backend)** live; **A1/G5** for queue | queue mock until G5 |
| B5.6 | S7 maturity + distribution live | Step 5.6 | **(no backend)** live; **A1/G6** for per-investor + recon | breakdown/recon mock until G6 |
| B5.7 | S8 investor invite issue live | Step 5.7 | **(no backend)** live; **A1/G7** for the list | list mock until G7 |
| B5.8 | S10 investor onboarding live | Step 5.8 | **(no backend)** live; **A7.1** for KYC docs | — |
| B5.9 | S11/S12 subscribe live | Step 5.9 | **(no backend)** subscribe; **A1/G9,G10** for list+detail | marketplace/detail mock until G9/G10 |
| B5.10 | S13 tax deductions/statements/Form16A live | Step 5.10 | **(no backend)** live; **A1/G11** for portfolio list | positions mock until G11 |
| B5.11 | S14 supplier status live | Step 5.11 | **(no backend)** read; **A5** for self-create; **A1/G12** tracker | disable self-create in live until A5 |
| B5.12 | S15 ack-user OTP login | Step 5.12 | **A4** for buyer reads + self-ack; **A7.3** login path | buyer reads/self-ack mock until A4 |
| B6 | Loading/error states, concurrency UX, idempotency, MFA gate, role msgs | Phase 6 | **A7.2** (MFA list), **A2** (role msgs) | graceful without them |
| B7 | Golden-path E2E through the UI + coverage matrix | Phase 7 | **(no backend)** for the command spine | mirrors `manual-test.http` |

---

## Dependency matrix — what's live now vs after backend work

| Screen | Live now (Part B only, no backend change) | Needs a Part A item to be fully live |
|---|---|---|
| S1 | OTP login (all roles) | A2 to display the real role |
| S2 | — | A3 (queues + stats) |
| S3 | supplier lifecycle commands + status | A1/G2 (supplier list) |
| S4 | buyer lifecycle + credit + KYB commands | A1/G3 (buyer + pricing lists) |
| S5 | listing spine, ops-checks, invoice PDF, go-live | A1/G4 (invoice/listing lists) |
| S6 | disbursement draft/approve (maker-checker) | A1/G5 (queue + amounts) |
| S7 | maturity, distribution draft/approve | A1/G6 (per-investor + recon) |
| S8 | invite issuance | A1/G7 (invite list) |
| S9 | — | A6 (audit query) |
| S10 | investor lifecycle commands | A7.1 (KYC-doc file id) |
| S11 | — (subscribe happens on S12) | A1/G9 (marketplace list) |
| S12 | subscribe, by-id read, invoice PDF download | A1/G10 (rich detail) |
| S13 | tax deductions, statements, Form 16A | A1/G11 (portfolio list) |
| S14 | supplier status read | A5 (self-create), A1/G12 (tracker) |
| S15 | ack-user OTP login (pending A7.3) | A4 (buyer reads + self-ack) |

**Takeaway:** roughly the entire **command/write spine and all by-id reads go live in Part B with no backend
change**; every remaining mock-flag maps to a specific Part A item (mostly A1 read models + A2 role discovery).
