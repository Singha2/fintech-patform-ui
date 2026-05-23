# Fintech Platform — MVP Mock

Interactive clickable mock of a 15-screen invoice-discounting platform.
Built with React 18 + Vite + Tailwind CSS. Hardcoded mock data only — no backend, no real auth.

## Stack

React 18 · Vite · Tailwind CSS · React Router v6

## Run locally

```bash
npm install
npm run dev   # http://localhost:5173
```

## Screens (15)

| ID | Screen | Persona |
|----|--------|---------|
| S1 | Login + MFA | All admin |
| S2 | Admin dashboard | All admin |
| S3 | Supplier onboarding workspace | Ops Executive |
| S4 | Buyer management + credit review | Credit Reviewer |
| S5 | Invoice checks + listing approval | Ops + Treasury |
| S6 | Disbursement approval queue | Treasury & Settlement |
| S7 | Distribution + reconciliation | Treasury & Settlement |
| S8 | Investor invite issuance | Compliance Reviewer |
| S9 | Audit log | Auditor |
| S10 | Investor onboarding | Investor |
| S11 | Listing marketplace | Investor |
| S12 | Listing detail + subscribe | Investor |
| S13 | Investor portfolio + statements | Investor |
| S14 | Supplier portal | Supplier |
| S15 | Buyer portal | Buyer |

## Docs

See `docs/` for blueprints, decision log, and build plan:
- `Mock_Build_Plan.md` — overall approach and 6-step recipe
- `STEP0_OUTPUT.md` — navigation map + screen inventory
- `STEP2_INVESTOR_BLUEPRINT.md` — investor flow spec
- `STEP4_ADMIN_BLUEPRINT.md` — admin console spec
- `STEP5_SUPPLIER_BUYER_BLUEPRINT.md` — supplier + buyer portal spec
- `DECISION_LOG.md` — platform decision log
