# Tier 2 — Shared Store as the Live-Integration Seam (Implementation Plan)

> **Goal:** give the mock **cross-screen data continuity** (one entity travels the whole journey) by introducing
> a single shared client-side store — built so it **is** the data seam the backend plug-in uses later, not a
> throwaway. Approved design: **Option A (store-as-seam)**.
>
> **Non-negotiable:** this must create **zero friction** with the backend integration (`INTEGRATION_PLAN.md`,
> `HARMONIZATION.md` (the integration overview/index), `UI_INTEGRATION_BACKEND_SPEC.md`). Backend stays source of truth for all shapes.

---

## 1. The idea in one picture

```
        screens (S1…S15)
              │  read via selectors / write via operations
              ▼
        useStore()  ──────────────  ONE interface, two backings
              │
      ┌───────┴─────────────────────────────────────────┐
      │ DATA_MODE = 'mock'         │ DATA_MODE = 'live'    │
      │ in-memory reducer,         │ operations → src/api/ │
      │ seeded from mockData.js    │   services/* (POST cmд)│
      │ (this is Tier 2)           │ by-id reads → live GET │
      │                            │ list/detail selectors  │
      │                            │   → BE-4…BE-12 when     │
      │                            │     shipped, else the   │
      │                            │     in-memory projection│
      └────────────────────────────────────────────────────┘
```

The store's **operations mirror backend commands**; its **selectors mirror backend reads**. In mock mode both are
served from an in-memory projection seeded from `mockData.js`. At integration, the *same* screens keep calling
`useStore()`; only the backing swaps. **No screen is rewired twice.**

---

## 2. Why this aligns (and accelerates) the backend plan

| Concern | How this plan handles it |
|---|---|
| `INTEGRATION_PLAN.md` Phase 3 wants `src/api/services/*` (fn per command/read) | The store's operation set **is the same interface**. In mock mode it's the mock implementation of Phase 3; in live mode operations delegate to those services. |
| Backend read side is thin (no lists — gaps G1–G13; BE-4…BE-12 unbuilt) | The store **is the client-side projection** that composes list/marketplace/portfolio/dashboard views. It stands in for the missing reads now and hydrates from BE-4…BE-12 when they ship. |
| `DATA_MODE=mock\|live` switch (Phase 0) | The store reads `DATA_MODE` to pick its backing. Exactly the seam already specified. |
| Command envelope / optimistic concurrency / idempotency (live-only) | **Not faked in mock.** Added only at the live seam (the operation wrapper), so they don't pollute the store or screens. |
| Server-computed values (funding target, TDS, VA number) | Flagged `// backend computes — mock fakes` in the store; live mode takes them from the command re-read. Screens read the field either way. |
| Entity shapes must match the API | Already true — `mockData.js` was reshaped to API shapes in `API_ALIGNMENT.md`. The store keeps them; UI-composed fields stay `// GAP Gx`. |

**Net:** Tier 2 is not a detour from integration — it builds Phase 3's seam early, in mock form.

---

## 3. Store design

**Location:** `src/store/` (new). Nothing else in `src/` gets a competing data source.

**Shape — normalized collections keyed by id** (so cross-references resolve and screens compose views):
```
{
  suppliers:     { [supplier_id]: {...} },
  buyers:        { [buyer_id]: {...} },
  investors:     { [investor_id]: {...} },
  invites:       { [invite_id]: {...} },
  invoices:      { [invoice_id]: {...} },       // supplier-submitted + ops
  listings:      { [listing_id]: {...} },       // incl. status, funding_target, va_id, pricing_snapshot
  subscriptions: { [subscription_id]: {...} },
  disbursements: { [listing_id]: {...} },
  distributions: { [listing_id]: {...} },
  auditEvents:   [ ... ],                        // append-only, for S9 (projection of G8)
}
```
Seeded from `mockData.js` on init (a `seedFromMock()` that maps the S1–S15 blocks into these collections).

**Implementation:** `PlatformStore.jsx` = React Context + `useReducer`. Actions are the operations below. A
`useStore()` hook returns `{ ...selectors, ...operations, mode }`. One provider wraps the app in `App.jsx`
(outside the routers, alongside/ō inside `PersonaProvider`).

### 3.1 Operations (mirror backend commands)
Named and shaped like the backend commands so the live swap is 1:1. Each returns the updated entity (mock) /
the re-read entity (live).

| Store operation | Backend command it mirrors (live target) |
|---|---|
| `createSupplier(input)` / `advanceSupplier(id, toStatus)` | `POST /suppliers/create` / the supplier transition chain |
| `createBuyer(input)` / `advanceBuyer(id, toStatus)` / `setBuyerCredit(id, paise)` / `attestKyb(id, doc?)` | `/buyers/*`, `/credit/buyers/{id}/profile` |
| `issueInvite(input)` / `signUpInvestor(input)` / `advanceInvestor(id, toStatus)` | `/investor-invites/issue`, `/investors/*` |
| `submitInvoice(input)` | `POST /documents` + `POST /listings` (ops-created) |
| `createListing / recordOpsCheck / completeOpsChecks / recordBuyerAck / snapshotAndReady / approveGoLive` | `/listings/*` |
| `commitSubscription(listingId, input)` | `POST /listings/{id}/subscriptions/commit` |
| `draftDisbursement / approveDisbursement` | `/listings/{id}/disbursement/*` |
| `recordMaturity / draftDistribution / approveDistribution` | `/listings/{id}/{record-maturity,distribution/*}` |
| `acknowledgeInvoice(listingId)` (buyer self-ack) | `record-buyer-ack` (admin) / WS-2 self-ack (BE-15) |

Each operation also appends an `auditEvent` (so S9 becomes a real projection — closes G8 in mock).

### 3.2 Selectors (mirror backend reads)
| Store selector | Backend read (live target) |
|---|---|
| `getSupplier(id)`, `getBuyer(id)`, `getListing(id)`, `getSubscription(id)`, … | the existing by-id `GET`s |
| `listSuppliers()`, `listBuyers()`, `listInvites()`, `listListings({status})` | **BE-4, BE-5, BE-9, BE-6** (until shipped: projection) |
| `marketplaceListings()` (status=live) | **BE-14 / M10-full** |
| `investorPortfolio(investorId)` (subscriptions + summary) | **BE-14 / M10-full** |
| `disbursementQueue()`, `distributionInvestors(listingId)` | **BE-7, BE-8** |
| `dashboardQueues(role)`, `dashboardStats()` | **BE-12** |
| `supplierListings(supplierId)` | **BE-11** |
| `auditEvents(filter)` | **BE-13 / M17** |

Every selector gets a one-line comment naming its live target, so the integration session knows exactly what to
swap.

### 3.3 Friction-avoidance invariants (the guardrails)
1. Screens talk to `useStore()` **only** — never import another screen's state, never mutate `mockData` directly.
2. Entity shapes stay **API-faithful**; UI-composed fields keep the `// GAP Gx` marker.
3. **No live-only mechanics faked in mock** (no invented `aggregate_version`, no `X-Command-Id`). They belong to
   the live operation wrapper added at integration.
4. Server-computed values are flagged; mock fills a plausible number, live takes the re-read value.
5. The store is the **only** new data source; `DATA_MODE` selects the backing. Default stays `mock`.

---

## 4. Phased build (each phase builds green + is testable)

- **P1 — Scaffold (no screen changes): ✅ DONE.** `src/config.js` (DATA_MODE seam), `src/store/{PlatformStore.jsx,
  seed.js,selectors.js,operations.js}`, provider wrapped in `App.jsx`. Verified: build green; dev server mounts
  (HTTP 200, no errors); logic check seeds all 10 collections, selectors + operations + audit projection work.
  Screens are unchanged (still on their own local state) — migration starts in P2.
- **P2 — Onboarding continuity: ✅ DONE.** Migrated S3+S14 (supplier), S4 + S15 (buyer), S8 + S10 (investor)
  onto the store; a minimal S5 overlay reflects the store's buyer ack. Closes **G-A3** (S14 shows the supplier
  activated in S3, via router state + store) and **G-B3** (S15 ack writes to the store and stamps `buyer_ack`,
  which S5 reflects). Verified: build green; dev mounts; logic harness confirms supplier/buyer invoice scoping,
  new-supplier visibility, and ack → buyer_ack. Store gained `supplierInvoices`/`buyerInvoices` selectors and a
  richer `acknowledgeInvoice`.
- **P3 — Listing continuity: ✅ DONE.** Migrated S5 (ops checks + maker-checker go-live), S11 (marketplace), and
  S12 (detail) onto the store; S14 submit now tags `buyer_id`/`supplier_name` so the listing links its parties.
  Store gained `recordOpsCheck`, `createListing`, `approveGoLive` operations (+ shared `DEFAULT_CHECKS`) and
  `opsInvoices`/`listingDetail` selectors. Closes **G-C3** (S12 keyed off the clicked `listing_id`), **G-D1**
  (S14-submitted invoice reaches the S5 ops queue), **G-D3** (a go-live approved on S5 appears in the S11
  marketplace). Verified: build green; dev mounts (S5/S11/S12 → 200, no errors); 19-assertion logic harness walks
  S14 submit → all-pass checks → createListing (ready_for_review, idempotent) → go-live (live + VA) → marketplace
  → `listingDetail` links invoice/buyer/supplier, plus fail-check → `ops_checks_failed`.
- **P4 — Money continuity: ✅ DONE.** Migrated S12 commit, S6 (disbursement queue), S7 (distribution + maturity),
  and S13 (positions + summary) onto the store. Store gained `commitSubscription` (grows `committed_total`, flips
  to `fully_funded`, drafts a disbursement at funding), `approveDisbursement` (→ disbursed, advances
  subscriptions, drafts the distribution), `recordMaturity` (gates execute), `executeDistribution` (closes subs
  with per-investor outcome, matures the listing), plus `distributionsList`/`investorSummary` selectors and a
  scoped `investorPortfolio`. Closes **G-E1** (a commit that fills a listing drafts a disbursement into the S6
  queue) and **G-E4** (the executed distribution's net outcome lands on the investor's S13 portfolio). Reconciliation
  stays local (G6 — no read endpoint). Verified: build green; dev mounts (S6/S7/S12/S13 → 200); 22-assertion logic
  harness walks commit → fully_funded + disbursement draft → approve → distribution draft → maturity → execute →
  S13 shows the closed position (gross−tds−fee=net) and the summary counts it.
- **P5 — Verify + docs: ✅ DONE.** Walked all five journeys on **one fresh entity** end-to-end (`p5-walkthrough`
  harness: a new supplier → buyer → investor → invoice → listing → subscription → disbursement → distribution →
  matured position, 26 assertions incl. the S9 audit projection — all green). Added the **⭐ Golden path**
  click-path to `QA_TEST_JOURNEYS.md` (the human version of that walk, with the one honest investor-identity
  seam called out). `QA_TEST_JOURNEYS.md` §7 rows are all ✅. The **store ⇄ backend seam** note is §7 below.

Migration is **incremental**: a screen keeps working the moment it's migrated; un-migrated screens keep their
local state until their phase. No big-bang cutover.

---

## 5. File plan

```
src/store/PlatformStore.jsx     # NEW  context + reducer + provider
src/store/seed.js               # NEW  seedFromMock(mockData) → normalized collections
src/store/selectors.js          # NEW  read selectors (annotated with live targets)
src/store/operations.js         # NEW  command-shaped operations (annotated with live targets)
src/App.jsx                     # EDIT wrap <PlatformStoreProvider>
src/features/**/S*.jsx          # EDIT per phase: useState(mockData) → useStore()
docs/QA_TEST_JOURNEYS.md        # EDIT §7 statuses at P5
docs/TIER2_SHARED_STORE_PLAN.md # (this doc)
```
`mockData.js` stays as the **seed source** (unchanged). `DATA_MODE`/`config.js` from `INTEGRATION_PLAN.md` P0 is
introduced here if not already present (the store needs it to pick a backing).

---

## 6. What this does NOT do
- Does not touch the backend or its specs (mock-only; live backing is stubbed behind the seam for later).
- Does not add live API calls yet (that's the separate live-integration work; this makes it a drop-in).
- Does not fake command envelopes / concurrency / auth.
- Does not change entity shapes away from the backend contract.

---

## 7. Store ⇄ backend seam — the swap points (for the live-integration session)

The store is Phase 3's service layer in mock form. To go live, `DATA_MODE=live` swaps the *backing* of the store's
operations/selectors; **screens never change**. Where each thing maps is already annotated inline — this section
is the index of *how* the swap happens, not a restatement of the map.

**Operations → backend commands.** Each `operations.js` op carries a `// live: POST …` comment (full table in
§3.1). In live mode an op:
1. sends the command to `src/api/services/*` with `X-Command-Id` (+ `X-Aggregate-Version` on transitions);
2. gets back the **envelope** `{aggregate_id, aggregate_version, emitted_events, correlation_id}` — *not* the
   entity — so it must **re-read** `GET …/{id}` and dispatch that into the store. (Mock skips this; the store
   already holds the entity.) See [[backend-source-of-truth]] for the envelope contract.

**Selectors → backend reads.** Each `selectors.js` selector carries a `// BE-x` / `// live: GET …` target (table
in §3.2):
- **by-id** selectors (`getSupplier/getListing/getSubscription/…`) → the existing `GET …/{id}` directly.
- **list / projection** selectors (`listSuppliers`, `opsInvoices`, `marketplaceListings`, `disbursementQueue`,
  `distributionsList`, `investorPortfolio`, `investorSummary`, `dashboardStats`, `auditEvents`, `listingDetail`)
  → hydrate from **BE-4…BE-14** once shipped; **until then they keep serving the in-memory projection** — the UI
  never blocks on the thin read side (`HARMONIZATION.md` readiness map).

**⚠️ Two mock conveniences the live seam must split into explicit commands** (the mock auto-fires them so the
click-path is short; the backend does **not** auto-draft):
- `commitSubscription` auto-drafts a **disbursement** the moment a listing fills. Live: that's a separate maker
  `POST /listings/{id}/disbursement/draft` (triggered by a funding-complete event/queue), then the S6
  `approve`.
- `approveDisbursement` auto-drafts the **distribution**. Live: a separate `POST /listings/{id}/distribution/draft`
  after `record-maturity`, then `distribution/approve`.
  In both cases the mock collapses draft+surface into one step; live mode restores the maker-checker two-phase.

**Values flagged `// backend computes — mock fakes`** (funding_target, VA number/id, per-investor payout split,
disbursement UTR): in live mode these come from the command re-read, not the store's local guess. Screens already
read the field either way.

**One UI seam, not a store gap:** S12/S13 pin the investor identity to `inv-acct-001` (no investor login in the
mock). At integration the id comes from the auth session; the store's `investorPortfolio/investorSummary` are
already per-investor. (Called out in the `QA_TEST_JOURNEYS.md` golden path.)
