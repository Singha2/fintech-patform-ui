# Decision Log — Fintech Platform UI

Tracks non-obvious decisions, bugs found during build, and their resolutions.
Each entry: what changed, why, and what to watch for.

---

## DL-MOCK-001 — Persona → Screen mapping correction
**Date:** 2026-05-22
**Status:** Applied

### What broke
When logged in as **Founder / CEO** and clicking "Review →" on any queue item in S2 (Admin Dashboard), the target screen (e.g. S3 Supplier Onboarding, S6 Disbursement) would load correctly but the **left sidebar entry stayed un-highlighted**.

Same bug existed for the **Ops Lead** persona: its queue showed S3 and S6 items, but neither was in its `accessibleScreens`.

### Root cause
Two linked issues in `src/routes.js`:

**Issue A — wrong persona for `founder` login**
`LOGIN_PERSONA_MAP` mapped `founder → 'compliance-reviewer'`.
`compliance-reviewer` had `accessibleScreens: ['S1','S2','S8']` only.
But `PERSONA_ROLES` gave compliance-reviewer the `super_admin` role, so S2 correctly surfaced **all** queue items — including `supplier_onboarding → /s3` and `disbursement → /s6`.
Clicking those navigated to screens that were not in `accessibleScreens`, so the Sidebar rendered them as plain `<div>` (not `<NavLink>`). React Router can only auto-highlight a `<NavLink>` — a `<div>` is invisible to it regardless of the current URL.

**Issue B — incomplete `accessibleScreens` for `ops-treasury`**
`ops-treasury` carries roles `['ops_executive', 'treasury_and_settlement']` in `PERSONA_ROLES`.
Its queue therefore surfaced `supplier_onboarding → /s3` (from ops_executive) and `disbursement → /s6` (from treasury), but its `accessibleScreens` was only `['S1','S2','S5']`.
Same broken-link result.

### Fix applied

| # | File | Change |
|---|------|--------|
| 1 | `src/routes.js` | Added new `super-admin` persona with `accessibleScreens: ['S1','S2','S3','S4','S5','S6','S7','S8']` |
| 2 | `src/routes.js` | `LOGIN_PERSONA_MAP`: `founder → 'super-admin'` (was `'compliance-reviewer'`) |
| 3 | `src/routes.js` | `ops-treasury` `accessibleScreens`: `['S1','S2','S5']` → `['S1','S2','S3','S5','S6','S7']` (union of ops_executive + treasury_and_settlement screen sets) |

No changes to `Sidebar.jsx`, `App.jsx`, or any screen file.

### Invariants to maintain going forward
- Every queue item type in `QUEUE_SCREEN` must map to a screen that is in `accessibleScreens` for every persona whose `PERSONA_ROLES` produces that queue item.
- If a new queue item type is added to `mockData.S2.queues`, check this table before shipping.

---

## Persona → Screen Access Map (current state after DL-MOCK-001)

| Persona (routes.js id) | Login as (S1 dropdown) | Accessible Screens | Queue Roles |
|---|---|---|---|
| `super-admin` | Founder / CEO | S1–S8 (all admin) | compliance_reviewer, super_admin |
| `ops-executive` | — (switcher only) | S1, S2, S3 | ops_executive |
| `credit-reviewer` | Credit Lead | S1, S2, S4 | credit_reviewer |
| `ops-treasury` | Ops Lead | S1, S2, S3, S5, S6, S7 | ops_executive, treasury_and_settlement |
| `treasury-settlement` | — (switcher only) | S1, S2, S6, S7 | treasury_and_settlement |
| `compliance-reviewer` | — (switcher only) | S1, S2, S8 | compliance_reviewer, super_admin |
| `auditor` | Auditor | S9 only | — |
| `investor` | — (switcher only) | S10–S13 | — |
| `supplier` | — (switcher only) | S14 | — |
| `buyer` | — (switcher only) | S15 | — |

### Queue item type → screen routing

| Queue item type | Target screen | Must be accessible to |
|---|---|---|
| `supplier_onboarding` | S3 | ops-executive, ops-treasury, super-admin |
| `invoice_check` | S5 | ops-executive, ops-treasury, super-admin |
| `listing_golive` | S5 | ops-treasury, treasury-settlement, super-admin |
| `buyer_credit` | S4 | credit-reviewer, super-admin |
| `supplier_credit` | S4 | credit-reviewer, super-admin |
| `kyc_approval` | S8 | compliance-reviewer, super-admin |
| `invite_issuance` | S8 | compliance-reviewer, super-admin |
| `disbursement` | S6 | ops-treasury, treasury-settlement, super-admin |
| `user_management` | S2 | super-admin |
