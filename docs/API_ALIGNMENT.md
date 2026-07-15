# API Alignment — UI ⇄ Backend

> **Source of truth: the backend.** The Spring Boot platform at
> `/Users/amitsingh/IdeaProjects/fintech-platform-backend` (served under **`/api/v1`**) is now the
> authoritative definition of every entity, command, status enum, and response shape. This UI mock exists to
> *visualise* that platform. Where this doc and any older UI-side spec disagree, **this doc + the backend win.**
> Backend catalogue: `fintech-platform-backend/docs/API_CATALOGUE.md`.

This document maps each of the 15 UI screens to the real backend endpoints, records the exact request/response
shapes the UI must conform to, corrects the mock's enum values to the real ones, and registers the **read-side
gaps** — places where a screen needs data the backend does not yet expose.

---

## 1. Contract mechanics the UI must adopt

The backend is **command-driven (CQRS-style)**, not REST CRUD. Three things follow:

### 1.1 Auth is a two-step OTP flow
```
POST /auth/login/password   { email, password }              → { challenge_id }
POST /auth/login/verify-otp { challenge_id, code }            → { bearer }
```
`bearer` is a session id sent as `Authorization: Bearer <bearer>` on every subsequent call.
Dev-only OTP peek: `GET /dev/last-otp?email=` → `{ email, code }`.
Buyer ack users log in OTP-only (no password) — same verify-otp step (S15).

### 1.2 Every write is a command with an envelope
| Header | When | Purpose |
|---|---|---|
| `X-Command-Id: <uuid>` | **every** POST/PUT command | idempotency key |
| `X-Aggregate-Version: <int>` | transitions on an existing aggregate | optimistic concurrency |

Command responses are **not** the entity — they are the envelope:
```json
{ "aggregate_id": "uuid", "aggregate_version": 3,
  "emitted_events": [{ "event_id": "uuid", "event_type": "…", "occurred_at": "ISO-8601" }],
  "correlation_id": "uuid" }
```
So after a command the UI must **re-read** (`GET …/{id}`) to refresh display state, and carry the new
`aggregate_version` into the next command.

### 1.3 Errors have a fixed shape
```json
{ "error_code": "…", "error_category": "…", "violating_rule": null,
  "violating_invariant_id": null, "message": "…", "status": 409,
  "correlation_id": "…", "retryable": false }
```

### 1.4 Roles = personas
Backend admin roles map 1:1 to the mock's admin personas. `auditor` in the mock has **no backend role yet**
(no audit query endpoint exists — see gaps).

| Mock persona | Backend `admin_role` |
|---|---|
| super-admin | `super_admin` |
| ops-executive | `ops_executive` |
| credit-reviewer | `credit_reviewer` |
| ops-treasury / treasury-settlement | `treasury_and_settlement` (+ `ops_executive`) |
| compliance-reviewer | `compliance_reviewer` |
| auditor | — (no endpoint) |

Money is **integer paise**; rates are **bps**. The mock already uses both — keep them.

---

## 2. Screen → endpoint map

Legend: ✅ backed by a real endpoint · ⚠️ partially backed · ❌ no endpoint (read-side gap, see §4).

### S1 — Login + MFA ✅
- `POST /auth/login/password` → `{ challenge_id }`
- `POST /auth/login/verify-otp` → `{ bearer }`
- (dev) `GET /dev/last-otp?email=` → `{ email, code }`

### S2 — Admin dashboard (queues + stats) ❌
No list/aggregate/metrics endpoint exists. Every queue and every stat tile is UI-composed. **Gap G1.**

### S3 — Supplier onboarding ⚠️
Commands (all ✅), read is by-id only.
| UI action | Endpoint |
|---|---|
| create | `POST /suppliers/create` `{ legal_name, constitution_type, pan, gstin, cin }` |
| agency consent | `POST /suppliers/{id}/grant-agency-consent` `{ scope: [..] }` |
| identity verified | `POST /suppliers/{id}/record-identity-verified` |
| submit / approve / reject / resubmit KYC | `POST /suppliers/{id}/submit-kyc` · `record-kyc-approved` · `record-kyc-rejected {reason}` · `resubmit-kyc` |
| financial profile | `POST /suppliers/{id}/submit-financial-profile` `{ top_buyers? }` |
| credit review | `POST /suppliers/{id}/record-credit-review` `{ exposure_cap_paise, risk_rating }` |
| MAA signed | `POST /suppliers/{id}/record-maa-signed` |
| activate | `POST /suppliers/{id}/activate` |
| read | `GET /suppliers/{id}` → **`{ supplier_id, status, aggregate_version }`** |

> The supplier **list** on S3, and the display fields (`legal_name`, `pan`, `gstin`, timestamps, consent detail)
> are **not** returned by `GET /suppliers/{id}`. Only `status` + `version` are. **Gap G2.**

### S4 — Buyer management + credit review ⚠️
| UI action | Endpoint |
|---|---|
| nominate | `POST /buyers/nominate` `{ legal_name, mca_cin, gstin, sector }` |
| identity verified | `POST /buyers/{id}/record-identity-verified` |
| credit assessment | `POST /buyers/{id}/record-credit-assessment` `{ credit_limit_paise }` |
| start engagement / activate | `POST /buyers/{id}/start-engagement` · `activate` |
| designate ack user | `POST /buyers/{id}/designate-ack-user` `{ email, phone, display_name }` |
| confirm payment instruction | `POST /buyers/{id}/confirm-payment-instruction` |
| KYB attestation | `POST /buyers/{id}/kyb-verification` `{ verified:true, document_id? }` |
| pricing band | `POST /credit/pricing-bands` `{ buyer_id, tenor_bucket, rate_range_min_bps, rate_range_max_bps, fee_bps, effective_from? }` |
| buyer credit profile | `POST /credit/buyers/{id}/profile` `{ sector, rating_source, rating, credit_limit_paise, tenor_cap_days }` |
| read | `GET /buyers/{id}` → `{ buyer_id, status, aggregate_version }` · `GET /buyers/{id}/kyb-verification` → `{ kyb_verified, kyb_verified_by, kyb_verified_at, kyb_document_id }` |

> Buyer **list** + display fields = **Gap G3.** Note: pricing band has a rate **range** (`min/max_bps`) + `fee_bps`,
> not a single `rate_bps` as the mock has.

### S5 — Invoice checks + listing approval ⚠️
Listing lifecycle commands (✅); the invoice "check_outcomes" grid maps to individual ops-checks.
| UI action | Endpoint |
|---|---|
| create listing | `POST /listings` `{ supplier_id, buyer_id, invoice_number, face_value_paise, invoice_date, tenor_days, irn? }` |
| start ops checks | `POST /listings/{id}/start-ops-checks` |
| record one check | `POST /listings/{id}/record-ops-check` `{ check_name, outcome? }` |
| complete ops checks | `POST /listings/{id}/complete-ops-checks` |
| request / record buyer ack | `POST /listings/{id}/request-buyer-ack {sla_hours}` · `record-buyer-ack {outcome, method?, evidence_ref?}` |
| price + snapshot | `POST /listings/{id}/snapshot-and-ready` `{ rate_bps }` |
| approve go-live | `POST /listings/{id}/approve-go-live` (treasury; checker≠maker) |
| declare shortfall | `POST /listings/{id}/declare-funding-shortfall` |
| attach invoice PDF | `POST /listings/{id}/invoice-documents { document_id }` |
| read | `GET /listings/{id}` → **`{ listing_id, status, funding_target, va_id, aggregate_version }`** |

> **Canonical ops-check names** (`check_name`): `irn_validity`, `eway_bill_match`, `buyer_supplier_relationship`,
> `duplicate_check`, `supplier_exposure_cap`, `buyer_limit_headroom`, `document_completeness`. `outcome` is
> `passed` (or null for vendor checks like `irn_validity`). The mock's keys (`irn_verified`, `buyer_supplier_rel`,
> `exposure_cap`, `buyer_limit`, `doc_completeness`) must be renamed to these. Buyer-ack is a **separate** command,
> not an ops-check. The invoice **list** + supplier/buyer names = **Gap G4.**

### S6 — Disbursement queue ⚠️
| UI action | Endpoint |
|---|---|
| draft (maker) | `POST /listings/{id}/disbursement/draft` |
| approve (checker≠maker) | `POST /listings/{id}/disbursement/approve` |
| read | `GET /listings/{id}/disbursement` → `{ payout_instruction_id, status, gross_amount, listing_status }` |

> Disbursement `status` enum is **`cash_payout_status`**: `drafted, approved, sent, executed, partial, failed,
> completed` — the mock's `pending_approval` must become `drafted`. There is **no queue list** endpoint; the
> UTR/net-amount/maker-name display fields are not returned. **Gap G5.**

### S7 — Distribution + reconciliation ⚠️
| UI action | Endpoint |
|---|---|
| draft distribution | `POST /listings/{id}/distribution/draft` |
| approve distribution | `POST /listings/{id}/distribution/approve` → closes deal `distributed` |
| read distribution | `GET /listings/{id}/distribution` → `{ payout_instruction_id, status, gross_amount, net_amount, total_tds_amount, listing_status, terminal_outcome }` |
| record maturity (buyer repay) | `POST /listings/{id}/record-maturity` `{ amount_paise, utr }` |
| inflow (webhook) | `POST /webhooks/banking/{vendor}/inflow.received` (HMAC) `{ va_id, amount_paise, utr, event_id }` |

> The **per-investor distribution table** (name, gross/tds/fee/net per investor) is **not** exposed — the read
> returns only listing-level totals. **Reconciliation** as a screen concept has **no endpoint** at all. **Gap G6.**
> TDS: 10% with verified PAN, 20% without (§206AA).

### S8 — Investor invite issuance ⚠️
| UI action | Endpoint |
|---|---|
| issue invite | `POST /investor-invites/issue` `{ email, phone }` |
| read invite list | ❌ no endpoint |

> `inv_invite_status` = `pending, consumed, expired`. The invite **list** on S8 = **Gap G7.** Issue takes only
> `{ email, phone }` — the mock's `justification`/`issued_by` fields are UI-only.

### S9 — Audit log ❌
No audit query endpoint exists. Entire screen is UI-composed. **Gap G8.**

### S10 — Investor onboarding ✅ (commands)
| UI step | Endpoint |
|---|---|
| consume invite → sign up | `POST /investors/sign-up` `{ invite_id, email, phone, sub_type }` |
| identity verified | `POST /investors/{id}/record-identity-verified` `{ pan, aadhaar_last4 }` |
| submit KYC | `POST /investors/{id}/submit-kyc` |
| suitability | `POST /investors/{id}/assess-suitability {mismatch?}` · `acknowledge-suitability-override {override_text}` |
| financial profile | `POST /investors/{id}/complete-financial-profile` `{ bank_account_last4 }` |
| approve / reject / resubmit KYC | `record-kyc-approved` · `record-kyc-rejected {reason}` · `resubmit-kyc` |
| MIA signed / activate | `record-mia-signed` · `activate` |
| read | `GET /investors/{id}` → `{ investor_id, status, aggregate_version }` |

> `sub_type` ∈ `resident_individual, huf, nri, institutional` (only first two active). `fatca_status` enum is
> `us_person, non_us_person, pending` — the mock's `not_us_person` is wrong → `non_us_person`.

### S11 — Listing marketplace ❌ (read gap) / ⚠️ (subscribe)
- Marketplace **list of live listings** — no endpoint. **Gap G9.**
- Subscribe/commit: `POST /listings/{id}/subscriptions/commit` `{ investor_id, amount_paise }` ✅

### S12 — Listing detail + subscribe ⚠️
- Detail read: `GET /listings/{id}` → only `{ listing_id, status, funding_target, va_id, aggregate_version }`.
  Pricing snapshot, invoice detail, buyer/supplier names, VA number/IFSC, committed-total = **not returned. Gap G10.**
- Invoice PDF: `GET /listings/{id}/invoice-documents` + `…/{documentId}/content` ✅
- Subscribe: `POST /listings/{id}/subscriptions/commit` ✅
- Read a subscription: `GET /listings/{id}/subscriptions/{subId}` → `{ subscription_id, status, amount, aggregate_version }`

### S13 — Investor portfolio + statements ⚠️
| UI section | Endpoint |
|---|---|
| TDS ledger | `GET /investors/{id}/tax/deductions?fy=` → `[{ listing_id, fy_code, gross_paise, tds_amount_paise, fee_paise, net_paise, challan_ref }]` ✅ |
| statements | `GET /investors/{id}/tax/statements` → `[{ period, kind, generated_at, doc_hash }]` ✅ |
| Form 16A | `POST …/tax/form-16a/{fyCode}/issue` · `GET …/tax/form-16a/{fyCode}` (bytes) ✅ |
| portfolio (subscriptions list, summary) | ❌ no per-investor subscription list. **Gap G11.** |

> `tax_investor_statement_kind` = `monthly_portfolio, form_16a`. `sub_subscription_status` (for positions):
> `committed, funds_pending, funds_received, confirmed, assignment_executed, distribution_received, closed,
> cancelled_by_investor, refunded, loss_realised`. Mock's `distribution_outcome` object is UI-composed.

### S14 — Supplier portal ⚠️
- Supplier identity: `GET /suppliers/{id}` (status + version only).
- Invoice/listing tracker (per-supplier list of invoices + listing state) — **no endpoint. Gap G12.**
- "Upload IRN" maps to `POST /listings` (ops-created) + `POST /documents` two-phase upload; supplier self-service
  create is **not built** backend-side (admin-only).

### S15 — Buyer portal ⚠️
- OTP login: `verify-otp` flow (ack user). ✅
- Ack an invoice: buyer ack is recorded admin-side via `POST /listings/{id}/record-buyer-ack`; there is **no
  buyer-facing self-ack endpoint** yet. **Gap G13.**
- Payment instruction display, per-invoice ack list, NOA download — **no buyer-facing read endpoint. Gap G13.**

---

## 3. Enum corrections (mock → backend)

Apply these value fixes to `mockData.js` and any screen that string-compares them.

| Field | Mock value (wrong) | Backend value (correct) | Enum |
|---|---|---|---|
| listing status | `ops_checks_in_progress` | `operational_checks_in_progress` | `deal_listing_status` |
| listing status | `ops_checks_passed` | (not a listing status — it's an invoice status `ops_checks_passed`) | `deal_invoice_status` |
| listing status | `ready_for_review`,`live`,`fully_funded`,`disbursed` | ✔ already correct | `deal_listing_status` |
| buyer status | `under_credit_review` | `credit_assessed` (or `nominated`/`identity_verified`) | `buyer_account_status` |
| investor fatca | `not_us_person` | `non_us_person` | `inv_fatca_status` |
| pricing band tenor | `61-90d`, `31-60d` | `61_90d`, `31_60d` | `risk_tenor_bucket` (`lte_30d,31_60d,61_90d,91_180d`) |
| disbursement status | `pending_approval`, `executed` | `drafted`, `approved`/`executed` | `cash_payout_status` |
| distribution status | `distribution_pending` | `drafted` → `approved` (deal → `distributed`) | `cash_payout_status` / `deal_terminal_outcome` |
| subscription status | `confirmed`,`closed` | ✔ valid (`confirmed`,`closed`) | `sub_subscription_status` |
| supplier status | `kyc_submitted`,`active` | ✔ valid | `sup_account_status` |
| invite status | `pending`,`consumed`,`expired` | ✔ valid | `inv_invite_status` |
| ops-check keys | `irn_verified`,`buyer_supplier_rel`,`exposure_cap`,`buyer_limit`,`doc_completeness` | `irn_validity`,`buyer_supplier_relationship`,`supplier_exposure_cap`,`buyer_limit_headroom`,`document_completeness` | `check_name` |

Full enum reference lives in the backend SQL migrations and `API_CATALOGUE.md`; the sets the UI touches:

- **deal_listing_status**: `draft, operational_checks_in_progress, awaiting_acknowledgment, ready_for_review,
  live, fully_funded, disbursed, in_repayment, matured_payment_received, distributed, closed, rejected_operational,
  acknowledgment_failed, funding_failed_refunded, cancelled_pre_disbursement, held_for_review, mildly_delayed,
  delayed, seriously_delayed, under_adjudication, disputed, dilution, fraud, defaulted, recovered`
- **sup_account_status**: `created, identity_verified, kyc_submitted, kyc_approved, credit_reviewed, maa_signed,
  active, suspended, blacklisted, voluntarily_exited`
- **buyer_account_status**: `nominated, identity_verified, credit_assessed, engagement_started, active, suspended`
- **inv_account_status**: `signed_up, identity_verified, kyc_submitted, suitability_assessed,
  financial_profile_completed, kyc_approved, mia_signed, active, suspended, exited`
- **sub_subscription_status**: `committed, funds_pending, funds_received, confirmed, assignment_executed,
  distribution_received, closed, cancelled_by_investor, refunded, loss_realised`
- **cash_payout_status**: `drafted, approved, sent, executed, partial, failed, completed`
- **admin_role**: `ops_executive, credit_reviewer, compliance_reviewer, treasury_and_settlement, super_admin`

---

## 4. Read-side gap register

These are the places the current UI shows data the backend **does not yet expose**. Every `GET` today is
*fetch-one-aggregate-by-id* returning `{ id, status, version }` (+ a couple of fields). There are **no list,
search, query, dashboard, or metrics endpoints**. Until the backend adds read models, these screens must keep
UI-composed mock data (marked in `mockData.js`).

| Gap | Screen | Missing read model |
|---|---|---|
| G1 | S2 | admin dashboard queues + platform stats |
| G2 | S3 | supplier list + supplier display fields (name/pan/gstin/consent/timestamps) |
| G3 | S4 | buyer list + display fields; pricing band list |
| G4 | S5 | invoice list + supplier/buyer names + per-check detail read |
| G5 | S6 | disbursement queue list + net amount / maker-checker / UTR |
| G6 | S7 | per-investor distribution breakdown; reconciliation entirely |
| G7 | S8 | investor invite list |
| G8 | S9 | audit log query |
| G9 | S11 | marketplace list of live listings |
| G10 | S12 | listing detail beyond status/target/va; pricing snapshot; VA number/IFSC |
| G11 | S13 | per-investor subscription/portfolio list + summary |
| G12 | S14 | per-supplier invoice/listing tracker |
| G13 | S15 | buyer-facing invoice list, payment instruction, self-ack, NOA |

**Implication for live integration (later phase):** only the **command** paths (writes) and the thin
**by-id reads** can be wired to the live backend today. The list/dashboard-driven screens (S2, S9, S11, S13, S14,
S15 read side) need backend read endpoints first. This register is the backlog for that.

---

## 5. How `mockData.js` is now organised

To keep the mock a faithful stand-in for the API, each screen's data distinguishes:

- **API-shaped fixtures** — objects whose field names, enum values, and (for commands) envelope match the real
  endpoint exactly. These are the future live-swap targets.
- **UI-composed data** — fields the backend does not return (the gaps above), kept so screens still render, and
  flagged with a `// GAP Gx` comment so it's obvious what is not yet real.

When the backend adds a read endpoint, delete the corresponding UI-composed block and point the screen at the
new fixture/endpoint.
