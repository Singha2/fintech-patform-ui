# QA Test Journeys — Mock UI Walkthroughs

> **For a Junior Dev / QA to independently exercise the mock end-to-end.** Covers the five business journeys —
> **Supplier onboarding, Buyer onboarding, Investor onboarding, Listing the invoice, Money movement** — as
> click-paths through the running mock, with the exact persona, screen, action, and expected result at each
> step, the edge-case variants to test, and the backend command each step *represents* (for traceability to
> `API_ALIGNMENT.md`).
>
> **Read this first — what the mock is and isn't.** This is a front-end-only mock (`CLAUDE.md`). Every screen
> keeps its **own local state seeded from `src/data/mockData.js`**; screens do **not** share state, and there is
> **no backend**. So a journey is walked partly by clicking within a screen and partly by **switching persona**
> to reach the next actor's screen. Some cross-persona handoffs are **simulated** in the mock (called out as
> **⚙️ Simulated** below) rather than being real data continuity. Every such simulation and every known gap is
> listed in **§7 Coverage & Gap Register** with a recommended fix — that section is the backlog for making the
> flow fully continuous.

---

## 0. Setup & conventions

**Run it**
```bash
npm install
npm run dev      # http://localhost:5173
```

**How you move between actors**
- **Admin login (S1, `/s1`):** the "Login as" picker maps to a persona: *Founder* → Super Admin, *Ops Lead* →
  Ops + Treasury, *Credit Lead* → Credit Reviewer, *Auditor* → Auditor. (Any password / any 6-digit code works.)
- **Persona switcher (top bar):** the **"Viewing as" dropdown** switches to any of the 10 personas and jumps to
  that persona's first screen. **This is the main way to hop between journeys/actors** (e.g. from an admin
  screen to the Investor, Supplier, or Buyer views).
- **S15 (Buyer) is standalone** — no top bar. Reach it by switching persona to **Buyer** (lands on `/s15`) or by
  typing `/s15`. To leave it, use the browser back button or type another route.
- **Variant switcher:** most screens have pill buttons (top of the screen) that preview edge-case states
  (empty, rejected, suspended, etc.). Use them to test the unhappy paths noted per journey.

**Legend:** ✅ real click action · ⚙️ Simulated (mock fakes a cross-actor step) · 🧪 variant to test ·
🚨 known gap (see §7) · 🔗 maps to backend command.

**Money = paise** (₹ = paise ÷ 100). **Rates = bps** (% = bps ÷ 100).

---

## 1. Journey A — Supplier Onboarding

**Goal:** take a supplier from onboarding through to *active*, then open the supplier portal.
**Actors/screens:** Ops Executive → **S3**; then Supplier → **S14**.
**Backend trace:** `POST /suppliers/create → record-identity-verified → submit-kyc → record-kyc-approved →
record-credit-review → record-maa-signed → activate` (see `API_ALIGNMENT.md §2 S3`).

| # | Persona / Screen | Action | Expected result | Trace |
|---|---|---|---|---|
| 1 | S1 | Login as **Ops Lead** → Verify & Enter | Lands on S2 dashboard | `auth/login` |
| 2 | S2 | Click **Review →** on the supplier-onboarding queue item | Navigates to S3 | — |
| 3 | S3 | Click **Open →** on *Alpha Components* | Right panel opens at the stage matching its status; amber "acting-as" banner shows | 🔗 `GET /suppliers/{id}` |
| 4 | S3 | Click through the stage buttons: **Submit & Trigger → Confirm & Continue → Submit KYC → Submit → Credit Review → Record Outcome → Initiate MAA e-Sign** | The wizard advances stage by stage (0→6) | 🔗 the supplier command chain |
| 5 | S3 | At the final stage click **Open Supplier Portal →** | Navigates to S14 (supplier portal) | — |
| 6 | S14 | Expand an invoice row (▼) | Shows listing / funding / disbursement detail | 🔗 `GET /suppliers/{id}` |
| 7 | S14 | Click **Exit acting-as** | Returns to S3 | — |

**🧪 Variants to test**
- **S3 → `agency_consent_missing`:** the acting-as banner turns red and **all stage buttons are disabled**
  (agency consent gates admin-assisted actions).
- **S3 → `kyc_rejected`:** at the KYC stage a rejection banner appears with **Re-submit KYC →** (returns to the
  KYC step).
- **S14 → `agency_consent_inactive`:** upload/submit actions are blocked.

**✅ Now wired (Tier 1):** **+ Create New Supplier** appends a `created` supplier and opens the wizard (G-A1);
activating persists the row's `status → active` in the list (G-A2).
**✅ Now continuous (Tier 2 / P2):** S3 and S14 share the store, so **S14 shows the supplier you actually
activated** (its identity + an empty invoice tracker for a brand-new supplier), passed via "Open Supplier
Portal →" (G-A3).

---

## 2. Journey B — Buyer Onboarding

**Goal:** take a buyer from *nominated* to *active*, set credit + pricing, attest KYB; then (buyer side) the
buyer acknowledges invoices in the buyer portal.
**Actors/screens:** Credit Reviewer → **S4**; then Buyer → **S15**.
**Backend trace:** `POST /buyers/nominate → record-identity-verified → record-credit-assessment →
start-engagement → activate`; `POST /buyers/{id}/kyb-verification`; `POST /credit/pricing-bands`
(`API_ALIGNMENT.md §2 S4`).

| # | Persona / Screen | Action | Expected result | Trace |
|---|---|---|---|---|
| 1 | S1 | Login as **Credit Lead** | Lands on S2 | `auth/login` |
| 2 | S2 | **Review →** on a buyer-credit queue item | Navigates to S4 | — |
| 3 | S4 | **Open →** on a buyer (e.g. *Tata Steel*, status `identity_verified`) | Side panel: identity (CIN/GSTIN), credit profile, pricing bands | 🔗 `GET /buyers/{id}` |
| 4 | S4 | Click the **Onboarding Action** button repeatedly | Status advances `identity_verified → credit_assessed → engagement_started → active` (badge updates each click) | 🔗 the buyer command chain |
| 5 | S4 | (Reliance) view **Pricing Bands** table + KYB identity | Displayed | 🔗 `GET /buyers/{id}/kyb-verification` |
| 6 | **Switch persona → Buyer** (top bar) | | Lands on **S15** (standalone) | — |
| 7 | S15 | Enter email → **Send OTP** → enter 6 digits → **Verify** | Buyer portal unlocks | 🔗 OTP login (ack user) |
| 8 | S15 | On a pending invoice click **Acknowledge** → **Confirm Acknowledgment** | Invoice flips to `acknowledged` | 🔗 (buyer self-ack — WS-2, not built) |
| 9 | S15 | **Copy** the escrow account number / IFSC | Copies to clipboard | — |

**🧪 Variants to test**
- **S4 → Four-eyes checkbox** (or a credit limit > ₹1 Cr): a **Second Approver** selector appears (four-eyes
  preview, DL-023/C6).
- **S15 → `no_pending_invoices`:** only acknowledged invoices show. **`buyer_suspended`:** portal blocked.

**✅ Now wired (Tier 1):** **Set / Update Credit Limit** persists the limit to the row + shows a confirmation
(G-B1); an **Open Buyer Portal →** button appears on an active buyer (navigates to S15) (G-B2).
**✅ Now continuous (Tier 2 / P2):** S15 acknowledgments write to the shared store, so acknowledging an invoice
that ops is checking (e.g. `INV-2026-0042`) makes its **`buyer_ack` check show as passed on S5** (G-B3).

---

## 3. Journey C — Investor Onboarding

**Goal:** issue an invite, onboard the investor to *active*, and reach the marketplace/portfolio.
**Actors/screens:** Compliance Reviewer → **S8**; then Investor → **S10 → S11 → S12 → S13**.
**Backend trace:** `POST /investor-invites/issue`; `POST /investors/sign-up → record-identity-verified →
submit-kyc → assess-suitability → complete-financial-profile → record-kyc-approved → record-mia-signed →
activate` (`API_ALIGNMENT.md §2 S8, S10`).

| # | Persona / Screen | Action | Expected result | Trace |
|---|---|---|---|---|
| 1 | S1 | Login as **Founder** (has compliance) | Lands on S2 | `auth/login` |
| 2 | **Switch persona → Compliance Reviewer** if needed → S8 (or Review → invite item) | | S8 invite screen | — |
| 3 | S8 | Fill email + phone + justification → **Issue Invite** | New `pending` invite prepended; 5s success banner | 🔗 `POST /investor-invites/issue` |
| 4 | S8 | On a pending invite click **Revoke** | Status → `revoked` | — |
| 5 | **Switch persona → Investor** (top bar) | ⚙️ **Simulated handoff** — the invite does not carry over (different actor, no shared state) | Lands on **S10** | — |
| 6 | S10 | Click through: **Continue → Send OTP → Verify → (Mock Upload) → Submit KYC → I Acknowledge (if mismatch) → Save & Continue → Submit** | Wizard advances the investor stages | 🔗 the investor command chain |
| 7 | S10 | Click **⚙️ Simulate: Admin Approves ›** | Bridges the compliance-approval step (faked in-mock) | ⚙️ (`record-kyc-approved` — really a Compliance action) |
| 8 | S10 | **Review & e-Sign** → **Browse Listings →** | Navigates to S11 | 🔗 `record-mia-signed` / `activate` |
| 9 | S11 | Click a **live** listing card | Navigates to S12 (detail) | 🔗 `GET /listings/{id}` |
| 10 | S12 | Enter amount ≥ ₹10,000 → **Commit Subscription** | Local subscription created; VA (virtual account) instructions shown | 🔗 `POST /listings/{id}/subscriptions/commit` |
| 11 | S12 | **View My Portfolio →** | Navigates to S13 | — |
| 12 | S13 | View positions, TDS, statements; toggle **Account Details** | Displayed | 🔗 `GET /investors/{id}/tax/deductions`,`/statements` |

**🧪 Variants to test**
- **S10 → `invite_expired`** (dead-end card), **`mismatch`** (suitability acknowledgment gate at step 3),
  **`kyc_rejected`** (forces re-submit).
- **S11 → `empty_marketplace`, `investor_suspended`.** **S12 → `committed`, `funding_window_closed`,
  `fully_funded_no_headroom`.** **S13 → `empty_portfolio`, `kyc_refresh_due`, `investor_suspended`.**

**✅ Now wired (Tier 1):** a pending invite has an **Onboard →** button that opens investor onboarding S10
(simulated handoff) (G-C1); S13 **Download / Form 16A** buttons show a "downloaded (mock)" confirmation (G-C4).
**✅ Now wired (Tier 2 · P3):** S12's detail body is now keyed off the **clicked** listing — it reads
`listingDetail(listingId)` from the store, so each marketplace card opens its own listing/invoice/buyer/supplier
(G-C3). **⚙️ Simulated (Tier 2):** approval is still **self-simulated** on S10 (labelled) (G-C2).

---

## 4. Journey D — Listing the Invoice

**Goal:** an invoice goes from submission → ops-checks → buyer ack → priced → **live**, then an investor funds it.
**Actors/screens:** Supplier → **S14** (submit); Ops Executive/Ops+Treasury → **S5** (checks); Treasury &
Settlement → **S5** (go-live); Investor → **S11 → S12**.
**Backend trace:** `POST /listings → start-ops-checks → record-ops-check ×N → complete-ops-checks →
record-buyer-ack → snapshot-and-ready → approve-go-live` (`API_ALIGNMENT.md §2 S5`).

| # | Persona / Screen | Action | Expected result | Trace |
|---|---|---|---|---|
| 1 | Supplier / S14 | **Upload** tab → choose IRN or Manual → fill fields → **Submit Invoice** | New invoice appears with status `submitted` | 🔗 `POST /documents` + `POST /listings` (ops-created) |
| 2 | **Switch persona → Ops + Treasury** → S5 | ✅ **Continuous** — the invoice you just submitted appears in the S5 "Invoice Checks" queue (`opsInvoices()`) with 8 pending checks | S5 "Invoice Checks" tab | 🔗 `GET /listings?…` (backend BE-4) |
| 3 | S5 | **Open →** an invoice → click **Pass** on each pending check | Check outcomes flip to `pass` | 🔗 `record-ops-check {check_name, outcome:passed}` |
| 4 | S5 | Click **Send Ack Request** then **Capture Manual Ack** | `buyer_ack` → pending → pass | 🔗 `request-buyer-ack` / `record-buyer-ack` |
| 5 | S5 | Switch to the **Listing Approval** tab | Shows the `ready_for_review` listing with maker name | 🔗 `snapshot-and-ready` |
| 6 | **Switch persona → Treasury & Settlement** (maker-checker!) | Ops+Treasury is the *maker* and is blocked from approving; **only Treasury & Settlement can approve** | S5 approval tab | — |
| 7 | S5 | **Approve Go-Live** → confirm in the **MFA modal** | Listing → `live`; **navigates to S6** | 🔗 `approve-go-live` |
| 8 | **Switch persona → Investor** → S11 | ✅ the listing you approved in step 7 now appears **live** in the marketplace (`marketplaceListings()`) | Marketplace | 🔗 `GET /listings?status=live` (backend BE-14) |
| 9 | S11 → S12 | Open a live card → **Commit Subscription** | Funds committed (as Journey C, step 10) | 🔗 `subscriptions/commit` |

**🧪 Variants to test:** S14 `ops_checks_failed` (recolors a status); S5 maker-checker block (try approving as
Ops + Treasury → button disabled with "cannot approve your own listing").

**✅ Now wired (Tier 1):** on S5, once all checks pass, a **Send to Listing Approval →** button promotes the
invoice into the maker-checker approval list and switches to the Approval tab (G-D2).
**✅ Now continuous (Tier 2 · P3):** the whole D chain travels one entity end-to-end via the store — a
S14-submitted invoice reaches the S5 ops queue (G-D1), and a go-live approved on S5 appears **live** in the S11
marketplace and opens the right S12 detail (G-D3, G-C3). The go-live still navigates to S6 (the disbursement
queue) as the next step. **Note:** the S12 **Commit Subscription** action is still local — wiring the
subscription into the store (and on to S6/S7/S13) is the money journey, **P4**.

---

## 5. Journey E — Money Movement

**Goal:** funded listing → disbursement (maker-checker) → maturity → distribution (principal + return − TDS) →
investor statements / Form 16A.
**Actors/screens:** Investor → **S12** (commit); Treasury & Settlement → **S6 → S7**; Investor → **S13**.
**Tip:** for a *continuous* run, start by committing on a live listing in **S12** (Journey D, step 9) — that
commit (once it fills the listing) drafts the very disbursement you approve in S6.
**Backend trace:** `POST /listings/{id}/disbursement/draft → approve`; `record-maturity`;
`distribution/draft → approve`; `tax/form-16a/{fy}/issue` (`API_ALIGNMENT.md §2 S6, S7`).

| # | Persona / Screen | Action | Expected result | Trace |
|---|---|---|---|---|
| 1 | S1 | Login as **Ops Lead**, then **Switch persona → Treasury & Settlement** | S2 / then S6 via queue | `auth/login` |
| 2 | S2 | **Review →** on the disbursement queue item | Navigates to S6 | — |
| 3 | S6 | **Open →** a disbursement (must be `all_signed`) | Detail panel; maker shown | 🔗 `GET /listings/{id}/disbursement` |
| 4 | S6 | **Approve Disbursement** → confirm **MFA modal** | Status → `executed` with a generated UTR; **navigates to S7** | 🔗 `disbursement/approve` (checker ≠ maker) |
| 5 | S7 | **Open →** the distribution (drafted on disbursement) → **Record Maturity** → **Execute Distributions (T+1)** | Status → `executed`; per-investor UTRs assigned; net = gross − TDS − fee | 🔗 `record-maturity` + `distribution/draft` + `approve` |
| 6 | S7 | **Reconciliation** tab | Buyer-payment vs expected (matched/partial) | 🔗 (reconciliation — backend BE-8) |
| 7 | **Switch persona → Investor** → S13 | ✅ the position you distributed in step 5 now shows **closed** with its net outcome; summary counts it | Portfolio + TDS / statements | 🔗 tax reads |

**🧪 Variants to test:** S6 requires `all_signed` **and** maker ≠ checker (only Treasury & Settlement approves;
Ops + Treasury is blocked as maker). S7 reconciliation `partial` row.

**✅ Now wired (Tier 1):** S7 has a **Record Maturity (buyer repayment)** step that gates **Execute
Distributions** (G-E2); **Raise Shortfall** on the reconciliation tab records a shortfall + disables (G-E3);
S13 **Download** buttons confirm (G-E4 download side).
**✅ Now continuous (Tier 2 · P4):** the money journey travels one entity via the store — a commit on S12 that
fills a listing **drafts the disbursement** into the S6 queue (G-E1); approving it drafts the distribution into
S7; recording maturity + executing the distribution **closes the investor's position with its net outcome on
S13** (G-E4). Only **reconciliation** (S7 tab) stays local — the backend exposes no reconciliation read (G6).

---

## ⭐ Golden path — one entity through all five journeys

This is the end-to-end smoke test: onboard a **brand-new** supplier + buyer + investor, then take a single
invoice all the way to a matured investor position — every hop reads/writes the same shared store, so what you
do upstream shows up downstream. (This exact chain is asserted on a fresh entity by the store harness; see the
verification note below.)

| # | Persona / Screen | Action | You should see |
|---|---|---|---|
| 1 | Ops Executive / **S3** | **+ Create New Supplier** → run the wizard → **Supplier Activated** | the new supplier row goes `active` |
| 2 | Ops Executive / **S3 → S14** | **Open Supplier Portal →** → **Upload** tab → fill + **Submit Invoice** | the invoice lands in *your* supplier's tracker |
| 3 | Credit Reviewer / **S4** | Nominate/activate a buyer → **Set Credit Limit** | buyer `active`, limit persisted |
| 4 | Compliance Reviewer / **S8** | **Issue Invite** → **Onboard →** → run **S10** wizard | a new investor reaches `active` |
| 5 | Ops + Treasury / **S5** | **Invoice Checks** → open the submitted invoice → **Pass** every check → **Send to Listing Approval →** | invoice `listed`; a `ready_for_review` listing appears |
| 6 | Treasury & Settlement / **S5** | **Listing Approval** tab → **Approve Go-Live** (MFA) | listing `live`; routes to S6 |
| 7 | Investor / **S11 → S12** | open the listing you just approved → **Commit Subscription** (enough to fill it) | listing → `fully_funded` |
| 8 | Treasury & Settlement / **S6** | **Open →** the disbursement (drafted by step 7) → **Approve Disbursement** (MFA) | disbursement `executed`; routes to S7 |
| 9 | Treasury & Settlement / **S7** | **Open →** the distribution → **Record Maturity** → **Execute Distributions** | per-investor UTRs; listing `matured` |
| 10 | Investor / **S13** | open the portfolio | the position shows **closed** with its **net** payout; summary counts it |

**⚠️ One honest mock seam (identity, not data):** S12/S13 always act as a **fixed investor persona**
(`inv-acct-001` "Rahul Mehta") because the mock has no investor login/identity switch. So the investor you
onboard in step 4 is *not* the identity that commits in step 7 / views in step 10 — the commit shows up under
`inv-acct-001`'s portfolio. The **store fully supports per-investor scoping** (the harness commits as the freshly
onboarded investor and sees exactly their position); only the two investor *screens* pin the identity. This
disappears at integration, where the logged-in investor's id comes from the auth session.

**🧪 Verification:** the store harness `p5-walkthrough` threads one fresh entity (`Zeta Foods → Nimbus Retail →
a new investor → one invoice → listing → subscription`) through all ten steps above and asserts each hop —
including that the **S9 audit projection** captured every command (supplier/buyer/investor activation, invoice
submit, listing create + go-live, subscription commit, disburse, distribute). All green.

---

## 6. Persona → screen quick-reference

| Journey segment | Persona to use | How to get there | Screens |
|---|---|---|---|
| Supplier onboarding | Ops Executive (via *Ops Lead* login) | S1 login | S3 → S14 |
| Buyer onboarding | Credit Reviewer (*Credit Lead* login) | S1 login | S4; Buyer via top bar → S15 |
| Investor invite | Compliance Reviewer (*Founder* login) | S1 login / top bar | S8 |
| Investor onboarding | Investor | top bar → Investor | S10 → S11 → S12 → S13 |
| Invoice checks / go-live | Ops + Treasury (maker) **and** Treasury & Settlement (checker) | top bar | S5 |
| Disbursement / distribution | Treasury & Settlement | top bar / S2 queue | S6 → S7 |
| Audit | Auditor (*Auditor* login) | S1 login | S9 (isolated) |

> **Maker-checker note:** on S5 (go-live) and S6 (disbursement) the approve button is **disabled for the maker**
> (Ops + Treasury) — you must **switch to Treasury & Settlement** to approve. This is the one place testing
> requires two persona hats.

---

## 7. Coverage & Gap Register (what to fix to make the flow continuous)

Each gap = a place the mock does not carry the journey through. Severity: **S1** breaks the journey chain,
**S2** = cosmetic/dead control, **S3** = data-continuity (upstream action not reflected downstream). **Status:
Tier 1 fixes are applied** (build green); **Tier 2 shared-store continuity: P2 (onboarding) + P3 (listing) +
P4 (money) done** — all five journeys now carry one entity end-to-end. Only P5 (one-entity walkthrough + docs) remains.

| ID | Journey | Gap | Sev | Fix | Status |
|---|---|---|---|---|---|
| G-A1 | Supplier | "+ Create New Supplier" dead | S2 | Appends a `created` supplier + opens wizard | ✅ Fixed |
| G-A2 | Supplier | Wizard advanced local step only; status not persisted | S3 | Activation sets row `status:'active'` locally | ✅ Fixed |
| G-A3 | Supplier | S14 always showed Alpha Components | S3 | S3 passes supplier id; S14 reads it from the store | ✅ Fixed (P2) |
| G-B1 | Buyer | "Set / Update Credit Limit" dead | S2 | Persists the limit + confirmation | ✅ Fixed |
| G-B2 | Buyer | No S4 → S15 navigation | S1 | "Open Buyer Portal →" on active buyer | ✅ Fixed |
| G-B3 | Buyer | S15 ack local-only, didn't feed S5 `buyer_ack` | S3 | S15 ack writes to the store; S5 overlays buyer_ack | ✅ Fixed (P2) |
| G-C1 | Investor | S8 invite → S10 not connected | S1 | "Onboard →" on a pending invite (simulated) | ✅ Fixed |
| G-C2 | Investor | Approval self-simulated on S10 | S3 | Kept as a labelled mock bridge | ✅ Labelled |
| G-C3 | Investor | S12 body ignores clicked `listingId` | S3 | S12 reads `listingDetail(listingId)` from the store | ✅ Fixed (P3) |
| G-C4 | Investor | S13 Download / Form 16A buttons dead | S2 | Show "downloaded (mock)" confirmation | ✅ Fixed |
| G-D1 | Listing | S14-submitted invoice never reaches S5 | S1/S3 | S14 submit → store; S5 reads `opsInvoices()` | ✅ Fixed (P3) |
| G-D2 | Listing | S5 has no "promote invoice → listing" action | S1 | "Send to Listing Approval →" when all checks pass | ✅ Fixed |
| G-D3 | Listing | Go-live routes to S6; new listing never in S11 | S3 | Go-live sets store `live`; S11 reads `marketplaceListings()` | ✅ Fixed (P3) |
| G-E1 | Money | Subscription commit doesn't trigger disbursement | S3 | S12 commit fills the listing → drafts a disbursement into the S6 queue | ✅ Fixed (P4) |
| G-E2 | Money | Maturity static on S7 | S1 | "Record Maturity" step gates Execute | ✅ Fixed |
| G-E3 | Money | "Raise Shortfall" dead | S2 | Records shortfall + disables | ✅ Fixed |
| G-E4 | Money | Distribution results don't reach S13; downloads dead | S3 | S7 execute closes the sub with its net outcome; S13 shows it | ✅ Fixed (P4) |
| G-X1 | All | S2 Super Admin persona saw an empty queue | S2 | Added `super-admin` to `PERSONA_ROLES` | ✅ Fixed |

**Tier 2 (architectural — cross-screen data continuity) — done:** the shared cross-screen store (`src/store/`,
seeded from `mockData.js`, selected via `DATA_MODE`) now carries **all five journeys** end-to-end. Fixed via the
store: **G-A3, G-B3** (onboarding · P2); **G-C3, G-D1, G-D3** (listing · P3 — S14 submit → S5 checks/go-live →
S11 marketplace → S12 detail); **G-E1, G-E4** (money · P4 — S12 commit → S6 disbursement → S7 maturity/distribution
→ S13 portfolio). The only remaining S3-data caveat is reconciliation (G6, S7) which the backend exposes no read
endpoint for. Plan + phase status: `docs/TIER2_SHARED_STORE_PLAN.md`.

---

## 8. Test checklist (copy per run)

| Journey | Segment tested | Persona(s) | Variants tested | Result | Notes |
|---|---|---|---|---|---|
| A Supplier | S3 wizard → S14 | Ops, Supplier | consent_missing, kyc_rejected | ☐ | |
| B Buyer | S4 lifecycle → S15 ack | Credit, Buyer | four-eyes, buyer_suspended | ☐ | |
| C Investor | S8 → S10 → S11/12/13 | Compliance, Investor | invite_expired, mismatch, kyc_rejected | ☐ | |
| D Listing | S14 submit / S5 checks+go-live / S11-12 | Supplier, Ops, Treasury, Investor | ops_checks_failed, maker-checker block | ☐ | |
| E Money | S6 → S7 / S13 | Treasury, Investor | all_signed gate, partial recon | ☐ | |
