# Harmonization Readiness Map

> **Harmonization = Integration — one plan, not two.** Making this UI run against the backend *is* the
> integration effort; there is no separate "harmonization plan." **This is the single overview + index.** Each
> detail below is **owned by one doc** — keep it there, don't restate it here (or the docs bloat and drift).
> Backend is source of truth for all shapes. *Snapshot: 2026-07-16.*

---

## 1. Documentation map — who owns what (open the right one)

| Doc | Owns (the single source for…) |
|---|---|
| **HARMONIZATION.md** (this) | the overview: readiness map, status, sequence, doc index |
| `API_ALIGNMENT.md` | contract truth — endpoint ↔ screen ↔ response shape, enum fixes, **read-gap register G1–G13** |
| `INTEGRATION_PLAN.md` | the **UI build steps** (Phases 0–7): proxy, client, auth, service layer, documents, per-screen wiring |
| `TIER2_SHARED_STORE_PLAN.md` | the **store-as-seam mechanism** + its phases (P1–P5) |
| `MANUAL_TEST_PLAN.md` | the **junior-dev manual test plan** — setup, smoke test, golden path, test suites, sign-off |
| `QA_TEST_JOURNEYS.md` | clickable QA journeys + the mock-continuity gap register (G-A…G-E) |
| *backend repo* `docs/UI_INTEGRATION_BACKEND_SPEC.md` | the **backend additive endpoints BE-1…BE-16** |

If a fact lives in one of those, link to it — don't copy it into another doc.

---

## 2. The mechanism (one line)

**Harmonize = give the Tier 2 store a live backing.** The store's *operations* mirror backend **commands** and
its *selectors* mirror backend **reads**, so screens never change again — only the backing swaps via
`DATA_MODE=mock|live`:

```
screens → useStore() →  mock (in-memory seed)  ⇄  live (api/services/* commands + by-id reads + projection for gaps)
```

---

## 3. Status snapshot

| Layer | State |
|---|---|
| Contract alignment (shapes, enums, paise/bps, persona↔role) | ✅ done (`API_ALIGNMENT.md`) |
| Store seam | ✅ **complete** — P1 scaffold · P2 onboarding · P3 listing · P4 money · P5 verify+docs (`TIER2_SHARED_STORE_PLAN.md`) |
| Live UI rails (proxy, client, auth, services, documents) | ⏳ not started (`INTEGRATION_PLAN.md`) |
| Backend additive endpoints (BE-1…16) | ⏳ in progress (backend spec) |

---

## 4. The two tracks (condensed — details in the owned docs)

- **Track 1 — UI (Part B, this repo):** finish the seam (P3, P4) → build live rails (proxy → `client.js` →
  auth → service layer → documents) → **flip the store to live** → hardening. **Steps:** `INTEGRATION_PLAN.md`.
- **Track 2 — Backend (Part A, backend repo):** BE-1 `/auth/session` + BE-2 kyc-file (P0) → BE-4…BE-12 list
  reads (P1) → BE-13 audit/M17, BE-14 investor portal/M10-full, BE-15 buyer login/WS-2 → BE-16 CORS. **Specs:**
  `UI_INTEGRATION_BACKEND_SPEC.md`.

They don't conflict: Part B consumes the frozen command contract; Part A only *adds* read endpoints.

---

## 5. Readiness map — what goes live with **zero backend change** vs **waits on backend**

| Capability / screen | Live now (Part B only) | Waits on |
|---|---|---|
| Login (all roles) | ✅ OTP flow | role *display* → **BE-1** |
| All write commands (onboarding, listing lifecycle, disburse, distribute, subscribe) | ✅ | — |
| By-id reads (a supplier/listing/subscription's status) | ✅ | — |
| Documents (invoice PDF upload/attach/download) | ✅ | KYC-doc file id → **BE-2** |
| Dashboard S2 · lists on S3/S4/S5 · S6 queue · S7 breakdown · S8 list · S12 rich detail | store projection | **BE-4…BE-12** |
| Marketplace S11 · portfolio S13 | store projection | **BE-14 / M10-full** |
| Audit log S9 | store projection | **BE-13 / M17** |
| Buyer portal S15 (login + reads + self-ack) | mock | **BE-15 / WS-2** |

**Bottom line:** the whole command spine + by-id reads harmonize with **no backend change**; every remaining
screen keeps working on the store projection and flips to live **one endpoint at a time** as the backend ships
it. Nothing built now is thrown away.

---

## 6. Recommended sequence

1. **Finish the seam** — ✅ **done (P2–P5).** Every journey (onboarding, listing, money) runs on `useStore()`;
   all five verified on one fresh entity end-to-end. Swap points documented in `TIER2_SHARED_STORE_PLAN.md` §7.
2. **Build the live rails** — Part B: proxy → client → auth → services → documents. *(no backend dependency · next)*
3. **Flip the store to live** — commands + by-id reads run against the backend. *(the "it's talking to the backend" milestone)*
4. **Wire BE-1/BE-2** as they land — role display, KYC docs.
5. **Flip list selectors** projection → live as **BE-4…BE-12** ship (one per screen).
6. **Portals** (BE-14/BE-15) with their milestones; **prod CORS** (BE-16) at deploy.
7. **Hardening** throughout — loading/error, optimistic concurrency, idempotency, MFA gating (all admin commands), 403 handling.

**Pacing note:** the backend's thin read side is the pacing item — ~9 screens stay on the projection until
BE-4…BE-14 land. The investor portal (M10-full) and buyer OTP login (WS-2) are deferred by backend design and
stay mock longest, by intent.
