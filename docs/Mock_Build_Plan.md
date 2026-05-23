# Mock Build Plan — Fintech Platform MVP

**Purpose.** This is the operating manual for building the 15-screen interactive React mock of the invoice-discounting platform. It is the single reference any build session points to. Add it to the project so every new session can read it.

**What the mock is.** A clickable React + Tailwind app on hardcoded JSON — no backend, no auth, no real logic. Its three jobs: (1) align the founder by letting them *click*, (2) force end-to-end flow clarity, (3) seed the API contracts via its mock-data shapes. The screens are built in the real frontend stack so they become production seeds later, not throwaway.

**One discipline above all.** You review the mock by *clicking it*, not by reading its source. The "lost in thousands of lines" concern applies to the real backend later — not to this mock.

---

## 1. Screen Inventory (15)

Phase 1 is admin-heavy, so the console dominates.

| # | Screen | Persona |
|---|---|---|
| S1 | Login + MFA | All admin |
| S2 | Admin dashboard (role-scoped work queues) | All admin |
| S3 | Supplier onboarding workspace ("acting-as" mode) | Ops Executive |
| S4 | Buyer management + credit review | Credit Reviewer |
| S5 | Invoice operational checks + listing approval | Ops + Treasury |
| S6 | Disbursement approval queue | Treasury & Settlement |
| S7 | Distribution + reconciliation view | Treasury & Settlement |
| S8 | Investor invite issuance | Compliance Reviewer |
| S9 | Audit log / auditor read-only view | Auditor |
| S10 | Investor onboarding (invite → KYC → suitability → agreement) | Investor |
| S11 | Listing marketplace (browse live listings) | Investor |
| S12 | Listing detail + subscribe | Investor |
| S13 | Investor portfolio + statements | Investor |
| S14 | Supplier portal (upload, listing & funding status) | Supplier |
| S15 | Buyer minimal portal (acknowledge + payment instructions) | Buyer |

If a screen is missing, merged, or wrong, fix it in this table first — the cheapest place to change.

---

## 2. The Core Optimisation

Build the **reusable skeleton once** — layout, navigation, persona switcher, and a small component kit (Button, Table, Card, StatusBadge, FormField, PageHeader). After that, **every screen is just those pieces arranged with mock data — 50–80 lines each, not 300.** Build screens independently and you repeat the styling 15 times; build the kit first and screens become cheap.

---

## 3. The 6-Step Recipe

Each step is one scoped Claude session (large steps split into two). The **Tell Claude** line is the prompt; keep prompts this tight.

### Step 0 — The spine *(one sitting)*
- **Tell Claude:** "Generate the navigation map (Mermaid) + a one-line purpose for each of the 15 screens."
- **Output:** half a page — the map every later step references.

### Step 1 — Build the skeleton ONCE *(the key step)*
- **Tell Claude:** "Build a React + Tailwind app shell: routing for all 15 named screens as empty placeholders, a persona/role switcher in the corner, a top-nav + sidebar layout, and a reusable component kit — Button, Table, Card, StatusBadge, FormField, PageHeader. One `mockData.js` with empty stubs. No real screens yet."
- **Output:** a clickable *empty* app — navigate all 15 routes, switch personas. Each route shows a placeholder.

### Step 2 — Investor flow *(S10–S13)*
- **Tell Claude:** "In the existing app, implement the 4 investor screens using the component kit. Add their mock data to `mockData.js`. Wire the click-paths per the nav map."
- **Output:** investor journey clickable end-to-end. **First founder demo.**

### Step 3 — Founder review + iterate
- **Tell Claude:** "Founder feedback: [bullet list]. Apply only these changes to the investor flow."
- A wrong flow now costs 4 screens, not 15.

### Step 4 — Admin console *(S1–S9, the Phase-1 spine)*
- Implement into the existing app, same kit. Split across two sessions: (a) dashboard + supplier onboarding + buyer/credit; (b) approval queues + invite issuance + audit view.

### Step 5 — Supplier, Buyer, Auditor *(S14, S15, S9)*
- Thin screens. One session.

### Step 6 — Responsive + polish pass
- **Tell Claude:** "Verify every screen works at phone and iPad widths; fix any overflow." Confirms mobile/iPad compatibility — free, because it's real React + Tailwind.

**Total:** roughly 6–8 focused sessions to a complete clickable 15-screen app.

---

## 4. The 5 Rules That Keep It Optimised

1. **One growing artifact, not 15 files.** The founder always has one thing to click. Each step *updates* the same app.
2. **One `mockData.js`.** All JSON in one place — shape it like real API responses so it seeds the OpenAPI specs later.
3. **Build the kit before the screens.** Never style a button twice.
4. **One flow per session.** Every prompt is "implement *this* persona's screens," never "build the app." Caps each response at a reviewable size.
5. **Judge by clicking, not reading.** This removes the overwhelm.

---

## 5. Per-Screen Blueprint Template

Used in the depth passes (Steps 2, 4, 5) — write this for a screen right before building it, not all 15 upfront.

```
### S<NN> — <Screen Name>
- Persona(s):        who sees this
- Purpose:           one line
- Entry from:        which screen(s) lead here
- Exits to:          where you can go next
- Data shown:        the fields/lists displayed   -> seeds API response + mock JSON
- Actions:           buttons/commands available    -> seeds API endpoints + events
- State variants:    e.g. listing: draft|live|funded
- Rules (DL/C refs): keeps coherence with the Decision Log
- Founder notes:     open questions for feedback
```

The **Data shown** and **Actions** lines do double duty: human spec *and* the seed of the API contract. Nothing gets written twice.

---

## 6. Context-Load Prompt for a New Build Session

Paste at the start of each build session. Scope it to the step(s) you're doing.

> I'm building the Fintech Platform MVP (invoice discounting). All platform docs are in this project — Decision Log, Product Spec, Architectural Constraints, Bounded Contexts, SQL schema — plus `Mock_Build_Plan.md` describing a 6-step approach to a 15-screen interactive React mock.
>
> First, read `Mock_Build_Plan.md` and the Spec's personas/journeys. Confirm you understand the 15 screens and the 6 steps.
>
> Today we do **Step <N> ONLY**: [paste the Tell-Claude line for that step].
>
> Stop after this step so I can review. Do not build beyond its scope.

---

## 7. Tech Notes for the Mock

- **Stack:** React + Tailwind (matches the production frontend). React Router for navigation.
- **No backend, no API calls, no real auth.** Fake login sets a role in state; the persona switcher flips it.
- **Mock data only:** all lists and detail views read from `mockData.js`. Shape each object like the API response it will eventually replace.
- **Responsive by default:** mobile-first Tailwind so phone/iPad work from day one — no native app needed in Phase 1.
- **Seeds, not throwaway:** in the real build (Phase 5+), screens get wired to live APIs; the layout and components carry over.

---

## 8. Where This Sits in the Bigger Plan

Once a flow's mock is stable, extract its `mockData.js` shapes into OpenAPI specs. The mock is the front edge of the architecture work; schema fixing (Flyway migrations, the `tblMfaFactor` collision, dropping deferred tables) runs in parallel because it has no dependency on the mock.
