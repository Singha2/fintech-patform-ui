# Fintech Platform — MVP Mock · CLAUDE.md

## What this is
A 15-screen interactive React mock of an **invoice-discounting platform**.
No backend, no real auth — all data is hardcoded in `src/data/mockData.js`.
Purpose: founder alignment by clicking, flow clarity, and seeding future API contracts.

---

## Stack & commands
```
React 18 · Vite · Tailwind CSS · React Router v6
```
```bash
npm install          # install deps
npm run dev          # dev server → http://localhost:5173
npm run build        # production build → dist/
```

---

## Directory layout
```
src/
  App.jsx                        # routes + persona switcher wiring
  routes.js                      # SCREENS[], PERSONAS[], SIDEBAR_GROUPS, helpers
  main.jsx                       # entry point
  index.css                      # Tailwind base

  components/
    layout/
      Layout.jsx                 # TopBar + Sidebar + <Outlet>
      TopBar.jsx                 # "Viewing as" persona dropdown
      Sidebar.jsx                # persona-scoped nav links
    kit/                         # reusable UI primitives (use only these)
      Button.jsx                 # variant: primary | ghost
      Card.jsx                   # white rounded panel, optional title/subtitle
      FormField.jsx              # label + input wrapper
      PageHeader.jsx             # page title + subtitle
      StatusBadge.jsx            # coloured pill: gray|amber|green|red|blue|purple
      Table.jsx                  # columns[{key,label,render}] + rows[]
    MfaModal.jsx                 # re-usable MFA confirmation overlay
    Placeholder.jsx              # stub for unbuilt screens

  context/
    PersonaContext.jsx           # currentPersona state + setPersonaById()

  data/
    mockData.js                  # ALL mock data keyed S1–S15

  utils/
    format.js                    # formatPaise(), formatDate(), formatDatetime(),
                                 # formatRate(), fundingPct()

  features/
    admin/     S1–S8.jsx
    auditor/   S9.jsx
    investor/  S10–S13.jsx
    supplier/  S14.jsx
    buyer/     S15.jsx

docs/
  Mock_Build_Plan.md             # 6-step build recipe + operating rules
  STEP0_OUTPUT.md                # nav map (Mermaid) + screen inventory
  STEP2_INVESTOR_BLUEPRINT.md    # investor flow spec (S10–S13)
  STEP4_ADMIN_BLUEPRINT.md       # admin console spec (S1–S9)
  STEP5_SUPPLIER_BUYER_BLUEPRINT.md  # supplier + buyer spec (S14–S15)
  DECISION_LOG.md                # platform decision log (DL-xxx, C-xxx refs)
```

---

## Screen inventory

| ID | Route | Screen | Persona | Status |
|----|-------|--------|---------|--------|
| S1 | /s1 | Login + MFA | All admin | ✓ built |
| S2 | /s2 | Admin dashboard | All admin | ✓ built |
| S3 | /s3 | Supplier onboarding | Ops Executive | ✓ built |
| S4 | /s4 | Buyer management + credit review | Credit Reviewer | ✓ built |
| S5 | /s5 | Invoice checks + listing approval | Ops + Treasury | ✓ built |
| S6 | /s6 | Disbursement approval queue | Treasury & Settlement | ✓ built |
| S7 | /s7 | Distribution + reconciliation | Treasury & Settlement | ✓ built |
| S8 | /s8 | Investor invite issuance | Compliance Reviewer | ✓ built |
| S9 | /s9 | Audit log | Auditor | ✓ built |
| S10 | /s10 | Investor onboarding | Investor | ✓ built |
| S11 | /s11 | Listing marketplace | Investor | ✓ built |
| S12 | /s12 | Listing detail + subscribe | Investor | ✓ built |
| S13 | /s13 | Investor portfolio + statements | Investor | ✓ built |
| S14 | /s14 | Supplier portal | Supplier | ✓ built |
| S15 | /s15 | Buyer portal | Buyer | ✓ built |
| S16 | /s16 | Admin & Roles (provision + role assignment) | Super Admin | ✓ built |

---

## Persona → screens mapping

| Persona id | Name | Screens |
|------------|------|---------|
| super-admin | Super Admin (Founder) | S1–S8, S16 |
| ops-executive | Ops Executive | S1, S2, S3 |
| credit-reviewer | Credit Reviewer | S1, S2, S4 |
| ops-treasury | Ops + Treasury | S1, S2, S3, S5, S6, S7 |
| treasury-settlement | Treasury & Settlement | S1, S2, S6, S7 |
| compliance-reviewer | Compliance Reviewer | S1, S2, S8 |
| auditor | Auditor | S9 |
| investor | Investor | S10–S13 |
| supplier | Supplier | S14 |
| buyer | Buyer | S15 |

Switching persona via the TopBar dropdown triggers `handlePersonaChange` in
`App.jsx`, which sets context and navigates to the persona's first screen.

---

## Routing architecture

Two screens stand alone (no sidebar/topbar Layout wrapper):
- **S1** (`/s1`) — admin login. Calls `onLogin(personaId)` → sets persona → navigates to `/s2` or `/s9`.
- **S15** (`/s15`) — buyer OTP portal. Fully self-contained; renders its own minimal top bar after login.

All other screens render inside `<Layout>` (TopBar + Sidebar + content area).

In `App.jsx`:
```js
<Route path="/s1"  element={<S1 onLogin={handleLogin} />} />
<Route path="/s15" element={<S15 />} />                    // standalone
<Route element={<Layout ...>}>
  {SCREENS.filter(s => s.id !== 'S1' && s.id !== 'S15').map(...)}
</Route>
```

---

## Component kit rules
- **Always use the kit** — Button, Card, Table, StatusBadge, FormField, PageHeader.
- Never create new component files. Build screen logic inline in the feature file.
- Screen files target ~80 lines of JSX (mock data and JS helpers don't count).
- No animations, no theming, no extra abstractions.

---

## mockData.js conventions
- Single export default object keyed `S1`–`S15`.
- All monetary values stored in **paise** (divide by 100 for display via `formatPaise()`).
- Dates stored as ISO strings; display via `formatDate()` / `formatDatetime()`.
- Rates stored as **basis points** (bps); display via `(bps/100).toFixed(2) + '% p.a.'` or `formatRate()`.
- Each screen reads directly from `mockData.SXX`; state is initialised from mockData in `useState()`.

---

## Standard screen patterns

### Variant switcher (every screen has one)
```jsx
const VARIANTS = [{ id: 'normal', label: 'Normal' }, ...]
const [variant, setVariant] = useState('normal')
// pill button group at top of screen
```

### Tab navigation
```jsx
const [tab, setTab] = useState('tab_id')
// border-b-2 border-indigo-600 active pattern
```

### Expandable table rows
Track `expandedId` in state; ▼/▲ button in last column toggles it;
detail Card renders below the Table (not inline in `<tr>`).

### MFA confirmation
Import `MfaModal`; show on sensitive actions (go-live, disbursement approval).
`onConfirm` callback proceeds; `onCancel` dismisses.

### Acting-as banner (S3, S14)
Amber `bg-amber-50 border-amber-300` bar at top of content.
Flips red when `agency_consent_inactive` variant is active.
"Exit acting-as" button navigates back to parent screen.

### Rule footnotes
Every screen ends with:
```jsx
<p className="text-xs text-gray-400 mt-6">Rules: DL-xxx · C-xxx · ...</p>
```

---

## Key click-paths
- S1 login → S2 (admin) or S9 (auditor)
- S2 queue items → S3 / S4 / S5 / S6 / S8
- S3 "Supplier Activated" → **S14** ("Open Supplier Portal →" button)
- S14 "Exit acting-as" → S3
- S5 approve go-live → S6
- S6 disbursement → S7
- S8 invite issued → S10 (investor onboarding)
- S10 → S11 → S12 → S13 → back to S11
- S15 is standalone (OTP login → buyer dashboard, no nav to other screens)

---

## What each step built
- **Step 1** — App shell: routing, Layout, Sidebar, TopBar, PersonaContext, component kit, mockData stubs, Placeholder screens.
- **Step 2** — Investor flow: S10 (onboarding wizard), S11 (marketplace), S12 (listing detail + subscribe), S13 (portfolio + statements).
- **Step 4** — Admin console: S1 (login + MFA), S2 (dashboard + queues), S3 (supplier onboarding acting-as), S4 (buyer + credit review), S5 (invoice checks + listing approval), S6 (disbursement queue), S7 (distribution + reconciliation), S8 (investor invites), S9 (audit log).
- **Step 5** — Supplier + Buyer: S14 (supplier portal — IRN upload, expandable invoice tracker), S15 (buyer OTP portal — per-invoice ack, payment instructions).

---

## Open / TBD items (from blueprint founder notes)
- S14: Should supplier see a separate "Disbursement received" confirmation, or is the UTR sufficient?
- S14: Action log tab — how far back should agency actions be visible?
- S15: Is the NOA (View NOA) a direct PDF download or emailed to buyer?
- S15: Does acknowledging send a confirmation email, or is on-screen sufficient for Phase 1?
- S15: Overdue acknowledgments — auto-escalate to Ops Executive or just show overdue label?
- Step 6 (not yet done): Responsive + polish pass — verify all screens at phone and iPad widths.
