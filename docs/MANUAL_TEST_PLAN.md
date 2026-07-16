# Manual Test Plan — Fintech Platform Mock (mock-data mode)

> **Who this is for:** a developer or QA tester picking up the app for the first time, testing it **by clicking
> through the browser** with the built-in mock data. **No backend, no setup beyond `npm`.** Follow the steps top
> to bottom; fill in the **Result** column as you go.
>
> **Companion docs (optional):** `QA_TEST_JOURNEYS.md` (deeper journey notes + the gap register),
> `TIER2_SHARED_STORE_PLAN.md` (how cross-screen data flows). You do **not** need them to run this plan.

---

## 0. How to read this plan

- Each test has an **ID** (e.g. `TS-B1`), **steps**, and an **Expected result**.
- Mark **Result** as `Pass` / `Fail` / `Blocked`, and put anything odd in **Notes**.
- A test **Fails** if the actual result differs from Expected in any way (wrong number, dead button, error, blank
  screen). When it fails, note *what you saw* — that's the bug report.
- Legend used below: **▶ Steps**, **✅ Expected**, **⚠️ Watch out**.

---

## 1. Set up & run (one time)

You only need **Node.js** (v18+). Then, in the project folder:

```bash
npm install     # first time only
npm run dev     # starts the app
```

Open **http://localhost:5173** in your browser. If it loads a login screen, you're ready.
(Full setup help is in `README.md`.)

---

## 2. Five things to know before you click

These are the rules of the mock. Read them once — they explain most "is this a bug?" questions.

| # | Fact | Why it matters when testing |
|---|---|---|
| 1 | **There is no backend.** All data is fake and lives in your browser's memory. | Nothing is saved to a server. Nobody else sees your changes. |
| 2 | **Refreshing the browser (F5) resets ALL data** back to the starting sample. | Do a full end-to-end test **in one sitting without refreshing.** If something looks stuck, a refresh gives you a clean slate. |
| 3 | **You switch roles with the "Viewing as" dropdown** in the top bar (top-right). Switching does **NOT** reset your data — only a refresh does. | This is how you hand a task from one team member to another (e.g. Ops → Treasury) while keeping the same invoice/listing. |
| 4 | **Every screen has a "Preview state" switcher** (small pill buttons near the top). It lets you preview edge cases (empty, suspended, error) **without needing that data to really exist.** | Use it for the "negative" tests in §7. It only changes what that one screen shows. |
| 5 | **Logins and codes are not real.** Any 6-digit number works as an MFA / OTP code (e.g. `123456`). The password is pre-filled — just click the button. | Don't hunt for real credentials; there are none. |

---

## 3. Test-data cheat-sheet

**Admin login personas** (chosen on the login screen, step 2 "Login as" dropdown):

| Login as | Lands on | Can act as (roles) |
|---|---|---|
| Founder / CEO | Dashboard (S2) | super admin + compliance |
| Ops Lead | Dashboard (S2) | ops + treasury |
| Credit Lead | Dashboard (S2) | credit reviewer |
| Auditor | Audit log (S9) | auditor only |

**"Viewing as" personas** (top-bar dropdown, after login) and the screens each can reach:

| Persona | Screens |
|---|---|
| Super Admin (Founder) | S1–S8 |
| Ops Executive | S1, S2, S3 |
| Credit Reviewer | S1, S2, S4 |
| Ops + Treasury | S1, S2, S3, S5, S6, S7 |
| Treasury & Settlement | S1, S2, S6, S7 |
| Compliance Reviewer | S1, S2, S8 |
| Auditor | S9 |
| Investor | S10–S13 |
| Supplier | S14 |
| Buyer | S15 |

**Seeded sample entities** (already in the app at start):

- Suppliers: **Alpha Components Pvt Ltd** (sup-001, active), **Beta Metals Pvt Ltd** (sup-002, active).
- Buyers: **Reliance Industries Ltd** (buy-001, active), **Tata Steel Ltd** (buy-002, awaiting credit).
- Investor portfolio persona: **Rahul Mehta** (inv-acct-001) — this is the identity screens S12/S13 always act as (see §8).
- Marketplace listings: Reliance (live), Tata Steel (fully funded), Infosys (live).

**Money units:** amounts show as ₹ (rupees). When a screen asks you to *type* an amount (e.g. subscribing on
S12), type **rupees** (e.g. `43200`), not paise.

---

## 4. Smoke test (≈5 min) — do this first

If any of these fail, stop and report — the rest of the plan depends on them.

| ID | ▶ Steps | ✅ Expected | Result | Notes |
|---|---|---|---|---|
| SMK-1 | Open http://localhost:5173 | Login screen appears (no console errors) | | |
| SMK-2 | Click **Login** → pick **Ops Lead** in "Login as" → **Verify & Enter** | You land on the **Dashboard (S2)** with work-queue cards | | |
| SMK-3 | Open the top-bar **"Viewing as"** dropdown, pick each persona once | Each switch loads that persona's first screen without errors | | |
| SMK-4 | Visit one screen from every group: S3, S5, S9, S11, S14, S15 | Each renders content (tables/cards), no blank pages | | |
| SMK-5 | Press **F5** to refresh | App returns to the login screen; data is back to the starting sample | | |

---

## 5. ⭐ Golden path — the full business flow on ONE entity

This is the most important test: it proves the whole platform works **end to end** and that data flows from one
screen to the next. **Do all 10 steps in one sitting — do NOT refresh mid-way** (a refresh wipes your progress).
Switch roles only with the top-bar "Viewing as" dropdown.

> You will create a brand-new supplier, submit an invoice, get it checked and listed, invest in it as an
> investor, disburse funds, and finally see the investor get paid.

| # | Viewing as / Screen | ▶ Do this | ✅ Expected | Result |
|---|---|---|---|---|
| 1 | Ops Executive / **S3** | Create a new supplier and run the wizard to **activation** | New supplier row shows status **active** | |
| 2 | Ops Executive / **S3 → S14** | Click **Open Supplier Portal →**, go to **Upload Invoice**, fill the fields, **Submit Invoice** | The invoice appears in **your** supplier's invoice list | |
| 3 | Credit Reviewer / **S4** | Pick a buyer, set/confirm a **credit limit**, take it to **active** | Buyer shows **active**, limit saved | |
| 4 | Compliance Reviewer / **S8 → S10** | **Issue an invite**, click **Onboard →**, run the S10 wizard to the end | A new investor reaches **active** | |
| 5 | Ops + Treasury / **S5** (Invoice Checks) | Open the invoice you submitted in step 2 → click **Pass** on every check → **Send to Listing Approval →** | Invoice moves to the **Listing Approval** tab as *ready for review* | |
| 6 | Treasury & Settlement / **S5** (Listing Approval) | Click **Approve Go-Live**, enter any 6-digit code in the **MFA** box | Listing becomes **live**; you're taken to S6 | |
| 7 | Investor / **S11 → S12** | Find your new listing in the marketplace, open it, type the **full Funding Target** amount (in ₹) → **Commit Subscription** | Listing fills to **fully funded**; you see the Virtual Account panel | |
| 8 | Treasury & Settlement / **S6** | **Open →** the disbursement that just appeared → **Approve Disbursement** (MFA) | Disbursement shows **executed** with a UTR; you're taken to S7 | |
| 9 | Treasury & Settlement / **S7** (Distributions) | **Open →** the distribution → **Record Maturity** → **Execute Distributions** | Each investor gets a UTR; status **executed** | |
| 10 | Investor / **S13** | Open the portfolio | Your position shows **closed** with a **net** payout; the summary counts it | |

**✅ Golden path passes if:** the invoice you created in step 2 is the same one you checked (5), invested in (7),
disbursed (8), and got paid for (10) — the data followed you across all the screens.

⚠️ **Step 7 note on the investor identity:** the marketplace/portfolio always act as **Rahul Mehta**, not the
investor you onboarded in step 4. That's a known mock limitation (see §8) — it does **not** make this test fail.

---

## 6. Test suites by area

Run these for fuller coverage. Each is independent; refresh (F5) between suites for a clean start if you like.

### TS-A — Login & Dashboard (S1, S2)

| ID | ▶ Steps | ✅ Expected | Result | Notes |
|---|---|---|---|---|
| TS-A1 | Log in as **Founder / CEO** | Lands on Dashboard (S2) with queue cards | | |
| TS-A2 | Log in as **Auditor** | Lands on **Audit Log (S9)** directly (not the dashboard) | | |
| TS-A3 | On S2, click a **queue item** (e.g. an invoice check / disbursement) | Navigates to the matching screen (S3/S4/S5/S6/S8) | | |
| TS-A4 | Switch to **Super Admin** persona, view S2 | Queue is **not empty** (shows items across roles) | | |

### TS-B — Supplier onboarding (S3, S14)

| ID | ▶ Steps | ✅ Expected | Result | Notes |
|---|---|---|---|---|
| TS-B1 | S3: **+ Create New Supplier**, complete the wizard | Supplier is added and reaches **active** | | |
| TS-B2 | S3: on an active supplier, **Open Supplier Portal →** | Opens **S14** showing *that* supplier's name in the acting-as banner | | |
| TS-B3 | S14: **Upload Invoice** tab → fill fields → **Submit Invoice** | New invoice appears in the Invoices tab with status **submitted** | | |
| TS-B4 | S14: expand an invoice row (▼) | Shows listing/funding detail (or "not yet listed") | | |
| TS-B5 | S14: **Exit acting-as** | Returns to S3 | | |

### TS-C — Buyer management (S4, S15)

| ID | ▶ Steps | ✅ Expected | Result | Notes |
|---|---|---|---|---|
| TS-C1 | S4: select a buyer, **Set / Update Credit Limit** | Limit is saved and shown; confirmation appears | | |
| TS-C2 | S4: advance a buyer through to **active** | Status updates step by step to active | | |
| TS-C3 | S4: on an active buyer, **Open Buyer Portal →** | Opens **S15** (buyer portal) | | |
| TS-C4 | S15: enter email → **Send OTP** → any 6-digit code → **Verify** | Logs into the buyer dashboard | | |
| TS-C5 | S15: **Acknowledge** a pending invoice | Invoice shows acknowledged | | |

### TS-D — Investor onboarding & marketplace (S8, S10, S11, S12, S13)

| ID | ▶ Steps | ✅ Expected | Result | Notes |
|---|---|---|---|---|
| TS-D1 | S8: **Issue Invite** (email/phone) | New invite appears with status **pending** | | |
| TS-D2 | S8: on a pending invite, **Onboard →** | Opens investor onboarding **S10** | | |
| TS-D3 | S10: complete the wizard | Investor reaches **active**; **Browse Listings →** available | | |
| TS-D4 | S11: browse the marketplace | Live listings shown as cards; fully-funded ones look disabled | | |
| TS-D5 | S11: click a **live** listing | Opens **S12** showing *that* listing's details (not always the same one) | | |
| TS-D6 | S12: type an amount ≥ ₹10,000 → **Commit Subscription** | Shows a **Committed** panel with Virtual Account details | | |
| TS-D7 | S12: type an amount **below ₹10,000** → Commit | Blocked with a minimum-investment message | | |
| TS-D8 | S13: view portfolio | Positions, summary cards, TDS and statements render | | |
| TS-D9 | S13: click **Download** / **Download Form 16A** | Shows a "downloaded (mock)" confirmation | | |

### TS-E — Listing lifecycle (S5)

| ID | ▶ Steps | ✅ Expected | Result | Notes |
|---|---|---|---|---|
| TS-E1 | S5 (Invoice Checks): **Open →** an invoice | Detail + the list of checks appears | | |
| TS-E2 | S5: click **Pass** on each pending check | Each check flips to **pass** | | |
| TS-E3 | S5: with all checks passed, **Send to Listing Approval →** | Invoice moves to the **Listing Approval** tab | | |
| TS-E4 | S5: as **Ops + Treasury**, try to **Approve Go-Live** | **Blocked** — "cannot approve your own listing" (maker ≠ checker) | | |
| TS-E5 | S5: switch to **Treasury & Settlement**, **Approve Go-Live** + MFA | Listing goes **live**; routes to S6 | | |

### TS-F — Money movement (S6, S7)

| ID | ▶ Steps | ✅ Expected | Result | Notes |
|---|---|---|---|---|
| TS-F1 | S6: **Open →** a disbursement | Detail panel; shows maker, net amount, "all signed" | | |
| TS-F2 | S6: as **Ops + Treasury**, try **Approve Disbursement** | **Blocked** (maker ≠ checker) | | |
| TS-F3 | S6: as **Treasury & Settlement**, **Approve Disbursement** + MFA | Status **executed** with a UTR; routes to S7 | | |
| TS-F4 | S7 (Distributions): **Open →** → **Record Maturity** → **Execute Distributions** | Per-investor UTRs assigned; status **executed** | | |
| TS-F5 | S7 (Reconciliation) tab: on a non-matched row, **Raise Shortfall** | Row shows shortfall raised; button disables | | |

### TS-G — Audit (S9)

| ID | ▶ Steps | ✅ Expected | Result | Notes |
|---|---|---|---|---|
| TS-G1 | Log in as **Auditor** → S9 | Audit log lists events (type, actor, target, time) | | |
| TS-G2 | Run the golden path (§5) first, then open S9 | New events from your actions appear in the log | | |

---

## 7. Negative / edge-case tests (use the "Preview state" switcher)

Each screen's **Preview state** pills let you preview an edge case. Select the state and confirm the screen
responds sensibly (banner, empty state, blocked action).

| ID | Screen | Preview state | ✅ Expected |
|---|---|---|---|
| NEG-1 | S1 Login | **MFA Failed** | Verify is blocked with an "invalid code" message |
| NEG-2 | S1 Login | **Account Disabled** | Login blocked; "contact Super Admin" message |
| NEG-3 | S3 Supplier | **Consent Missing** / **KYC Rejected** | Warning banner; blocked/limited actions |
| NEG-4 | S14 Supplier portal | **Consent Inactive** | Red banner; Submit/actions disabled |
| NEG-5 | S14 Supplier portal | **Ops Checks Failed** | An invoice status shows failed (red) |
| NEG-6 | S10 Investor onboarding | **Invite Expired** / **Suitability Mismatch** / **KYC Rejected** | Flow blocked or flagged appropriately |
| NEG-7 | S11 Marketplace | **Empty Marketplace** | Friendly "no listings" empty state |
| NEG-8 | S11 Marketplace | **Investor Suspended** | Red suspended banner; cards not clickable |
| NEG-9 | S12 Listing detail | **Window Closed** / **No Headroom** | Subscribe panel replaced by a "closed / full" message |
| NEG-10 | S13 Portfolio | **Empty Portfolio** / **KYC Refresh Due** / **Investor Suspended** | Empty CTA / amber banner / red banner respectively |
| NEG-11 | S15 Buyer portal | **No Pending** / **Suspended** | No-invoices state / suspended state |

---

## 8. Known limitations — "working as designed", not bugs

Please do **not** log these as defects:

1. **Investor identity is fixed on S12/S13.** The marketplace and portfolio always act as **Rahul Mehta**
   (inv-acct-001). The investor you onboard on S10 is a different identity, so a subscription you make won't
   appear under a *newly onboarded* investor — it appears under Rahul Mehta. (Real login identity arrives with
   the backend.)
2. **Refreshing the browser resets everything.** In-memory data by design.
3. **Reconciliation (S7) is display-only** for now — the "matched/partial" rows are sample data; only **Raise
   Shortfall** is interactive.
4. **Codes and passwords aren't validated** — any 6-digit code works; the password is cosmetic.
5. **"Downloads" (statements / Form 16A / NOA) show a mock confirmation** instead of a real file.
6. Some values the backend will compute (funding target, Virtual Account number, payout split, UTRs) are
   **plausible fakes** in the mock.

---

## 9. Reporting a problem

When something fails, capture:

- **Test ID** (e.g. `TS-F3`) and **what you did** (the exact clicks).
- **What you expected** vs **what actually happened**.
- **Screen ID + persona** you were viewing as (e.g. "S6 as Treasury & Settlement").
- A **screenshot**, and anything red in the browser **Console** (open with F12 → Console tab).
- Whether it happens **again after a refresh** (reproducible?).

---

## 10. Test run sign-off

Fill this in at the end of a test pass.

| Field | Value |
|---|---|
| Tester name | |
| Date | |
| Build / commit tested | |
| Browser + version | |
| Smoke test (§4) | ☐ Pass ☐ Fail |
| Golden path (§5) | ☐ Pass ☐ Fail |
| Suites TS-A … TS-G (§6) | ___ / ___ passed |
| Negative tests (§7) | ___ / ___ passed |
| Blocking issues found | |
| Overall verdict | ☐ Ready for backend integration ☐ Needs fixes |

---

*Once this plan passes end-to-end on mock data, the app is ready for the live-integration work
(`INTEGRATION_PLAN.md`). The same journeys will then be re-run against the real backend.*
