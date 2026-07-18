# BACKEND → UI READINESS — the single backend-truth hand-off for UI integration

> **Read this before wiring any screen.** It is the backend team's authoritative statement of *what the live API
> actually ships today* for UI integration, plus **corrections to stale assumptions** in this repo's
> `INTEGRATION_PLAN.md` / `API_ALIGNMENT.md`. Written from the backend session (2026-07-18); implement in **this**
> (mock) session.
>
> **Scope:** UI integration only (frontend ↔ live API). **Not** vendor/ACL integration (verification/escrow/e-sign/
> KYC stubs → real) — that's a separate journey (backend ROADMAP Track C), don't mix it in here.
>
> **Source of truth for exact shapes:** backend `docs/API_CATALOGUE.md` (frozen). Golden rules unchanged: backend
> shapes win; the offline mock path (`DATA_MODE=mock`) must keep working; `npm run build` stays green.

---

## TL;DR — the backend read surface for UI is essentially COMPLETE

UI integration is **not backend-blocked** on the admin or investor spine. The plan in this repo predates several
shipped endpoints and still treats them as gaps. **Nothing to wait for — reconcile and wire.**

| Assumption in this repo's docs | Reality (verified in backend) | Action |
|---|---|---|
| "No current-identity / my-roles endpoint; derive persona from the login email" (`INTEGRATION_PLAN` Phase 2 / Step 6.5) | **`GET /auth/session` exists (BE-1)** and returns `kind`, `roles[]`, `admin_user_id`, `investor_id`, `mfa_fresh` | **Call `/auth/session` right after login**; drive persona + role-nav from it. Stop deriving from email. |
| "BE-2 kyc-file resolver does not exist — KYC-doc UI backend-blocked" (Step 4.3) | **Shipped:** `GET /suppliers/{id}/kyc-file`, `GET /investors/{id}/kyc-file` | Wire the KYC-doc panel; unblock Phase 4.3. |
| Gap register **G1–G12** — "no list/search/dashboard endpoints" | **Shipped: BE-4…BE-12** (all admin lists + dashboard) | Flip those screens from mock to live (see table below). |
| Investor portal (S11/S13) "await M10-full" | **Shipped: BE-14 + BE-17 (M10-D)** | Wire S11 + S13 against a real investor bearer (see §Investor portal). |

There is **no `/me`** endpoint — `GET /auth/session` *is* the who-am-I. Don't add or expect `/me`.

---

## Now-live endpoints (reconcile the gap register) — route → screen → gap it closes

Exact response keys: **backend `API_CATALOGUE.md`**. Enum/field corrections already tracked in this repo's
`API_ALIGNMENT.md §3` (e.g. `operational_checks_in_progress`, disbursement `drafted`, pricing **rate-range** not
single `rate_bps`, FATCA `non_us_person`) — those still apply; the backend is correct.

| BE | Route(s) | Screen | Gap closed |
|---|---|---|---|
| BE-1 | `GET /auth/session` → `{identity_id, kind, email, roles[], admin_user_id, investor_id, mfa_fresh, idle_expires_at, absolute_expires_at}` | all | persona/role discovery |
| BE-2 | `GET /suppliers/{id}/kyc-file`, `GET /investors/{id}/kyc-file` → `{kyc_file_id, subject_id, subject_type, status}` (404 until KYC submitted) | S3/S10 | KYC-doc id resolver (Step 4.3) |
| BE-4 | `GET /suppliers?status=&q=` | S3 | G2 |
| BE-5 | `GET /buyers?status=&q=`, `GET /credit/buyers/{id}/pricing-bands` | S4 | G3 |
| BE-6 | `GET /listings?status=&supplier_id=&buyer_id=`, `GET /listings/{id}/ops-checks` | S5 | G4 |
| BE-7 | disbursement queue + `GET /listings/{id}/disbursement/detail` | S6 | G5 |
| BE-8 | `GET /listings/{id}/distribution/investors`, `GET /listings/{id}/reconciliation` | S7 | G6 |
| BE-9 | `GET /investor-invites?status=` (emails are **hashed** — no plaintext) | S8 | G7 |
| BE-10 | `GET /listings/{id}/detail` (admin rich detail) | S12 | G10 |
| BE-11 | `GET /suppliers/{id}/listings` (admin view of a supplier's listings) | S14 | G12 |
| BE-12 | `GET /admin/work-queues?role=`, `GET /admin/stats` | S2 | G1 |

Wiring order: follow `INTEGRATION_PLAN.md` Phase 5 screen sequence (S2→S3→S4→S5→S6→S7→S8→S12→S14), each screen's
commands + by-id reads live, list reads now also live (were mock-flagged).

---

## Investor portal (S11 + S13) — BE-14 + BE-17, shipped (M10-D)

**Login (read-only):** investors use the **existing** `POST /auth/login/password → POST /auth/login/verify-otp`
flow (kind-agnostic). Dev investor: **`investor@dev.local` / `DevPass123!`** (OTP via `GET /dev/last-otp?email=`).
`GET /auth/session` returns `{ kind:"investor", roles:[], investor_id:"<uuid>", admin_user_id:null }` — **scope all
investor reads to that `investor_id`**, never a client-typed id.
> ⚠️ This is **dev/pilot login only**. Real investor login is passwordless email+OTP, **Phase B / BE-18** (not built).
> Wire the persona now against the dev bearer; the login mechanism won't change for the portal.

**S11 — marketplace** · `GET /listings?status=live`: with an investor bearer the backend **forces `status=live`**
(browse-all-live, not filtered to owned) — existing BE-6 row shape.

**S13 — portfolio** · `GET /investors/{investor_id}/subscriptions` (pass the **own** id):
```json
{ "rows": [ { "subscription_id":"…","listing_id":"…","amount":<paise>,"status":"committed|funds_pending|confirmed|assignment_executed|closed|…",
             "buyer_name":"…","supplier_name":"…","due_date":"YYYY-MM-DD",
             "distribution_outcome": {"gross":<paise>,"tds":<paise>,"fee":<paise>,"net":<paise>} | null } ],
  "summary": { "total_deployed_paise":<paise>,"total_returned_paise":<paise>,"active_positions":<int>,"matured_positions":<int> } }
```
Maps onto S13 `positionColumns` + `summaryCards`; **`rows` + `summary` come in one call** (adapt the
`investorPortfolio`/`investorSummary` selectors to read from this payload in live mode). `distribution_outcome` is
`null` until maturity; `wallet_attribution` is intentionally not returned. A mismatched id / non-investor-non-admin
→ **403** `cross_tenant_read`.

**Invoice-PDF download** (if wired on S12) · `GET /listings/{lid}/invoice-documents/{did}/content`: KYC-gated for
investors → not-yet-KYC investor gets **403** `kyc_not_approved`. Admin download unchanged.

**Persona mapping:** flip `API_ALIGNMENT.md §1.4`'s `investor` persona to **live-mapped (read-only)**. The investor
holds **no roles** → every command is correctly 403; keep the persona read-only (no commit/action buttons).
Investor writes (subscribe/pay) are **Phase B / BE-18** — do not stub a live write.

---

## Genuinely still deferred — KEEP these on the mock path (do NOT wire live)

| Screen / feature | Why | Milestone |
|---|---|---|
| **S9** audit log | `GET /audit/events` not built | BE-13 / **M17** |
| **S15** buyer portal + ack-user login + self-ack | passwordless ack-user login not built | BE-15 / **WS-2** |
| **Real investor login + investor self-commit** | dev-password-only today | BE-18 (backend DF-1) |
| Deferred *controls* the UI must not imply work | four-eyes >₹10Cr, pricing re-pricing, suspend/blacklist, agency-consent, at-rest encryption | backend-deferred |

Keep these visibly mock-flagged; do not fake them.

---

## Error shapes to handle (from live reads/commands)
- `401` — absent/expired bearer.
- `403 { "error_code":"role_not_held" }` — command not permitted for the caller's roles (also the investor-persona read-only signal).
- `403 { "error_code":"cross_tenant_read" }` — investor scoping violation (shouldn't happen if you use the session's own id).
- `403 { "error_code":"kyc_not_approved" }` — investor not KYC-approved for a document download.
- `409` — optimistic-lock (stale `X-Aggregate-Version`) → re-read then retry.
- `400` — validation; body carries `error_code` / `message`.

---
_Backend sources: `docs/UI_INTEGRATION_BACKEND_SPEC.md` (BE-1…BE-17 design), `docs/API_CATALOGUE.md` (exact shapes,
frozen), `docs/DECISION_LOG.md` `DL-BE-084` (investor portal), `docs/PROJECT_TRACKER.md` (status + Deferred fixes
DF-1/DF-2). Written 2026-07-18._
