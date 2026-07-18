# Fintech Platform — MVP UI

An interactive, clickable UI for a **15-screen invoice-discounting platform**.
Built with **React 18 + Vite + Tailwind CSS + React Router v6**.

> ⚠️ **This is a front-end-only prototype.** There is **no backend, no database, and no real authentication**. Every screen reads from hardcoded data in `src/data/mockData.js`. Its purpose is founder alignment, flow clarity, and seeding future API contracts — not production use.

---

## Table of contents

- [Prerequisites](#prerequisites)
- [Quick start (local setup)](#quick-start-local-setup)
- [Available commands](#available-commands)
- [How to use the app](#how-to-use-the-app)
- [Project structure](#project-structure)
- [Screens](#screens-15)
- [Personas](#personas)
- [Troubleshooting](#troubleshooting)
- [Deployment](#deployment)
- [Docs](#docs)

---

## Prerequisites

You only need **Node.js** installed. Everything else is pulled in by `npm install`.

| Tool | Version | How to check | How to get it |
|------|---------|--------------|---------------|
| Node.js | **18 or newer** (20+ recommended) | `node -v` | [nodejs.org](https://nodejs.org/) or use [nvm](https://github.com/nvm-sh/nvm) |
| npm | 9 or newer (ships with Node) | `npm -v` | Comes with Node.js |

> **Tip:** If you use `nvm`, run `nvm install 20 && nvm use 20`.

No database, no API keys, no `.env` file, and no other services are required to run this app locally.

---

## Quick start (local setup)

From a terminal:

```bash
# 1. Clone the repository (skip if you already have it)
git clone https://github.com/Singha2/fintech-patform-ui.git
cd fintech-patform-ui

# 2. Install dependencies (creates node_modules/)
npm install

# 3. Start the dev server with hot-reload
npm run dev
```

Then open the URL printed in your terminal — by default:

**http://localhost:5173**

That's it. The app runs entirely in your browser. Edit any file under `src/` and the page reloads automatically.

---

## Available commands

| Command | What it does |
|---------|--------------|
| `npm install` | Installs all dependencies into `node_modules/`. Run once after cloning (and again if `package.json` changes). |
| `npm run dev` | Starts the Vite dev server at `http://localhost:5173` with hot module reload. Use this for development. |
| `npm run build` | Creates an optimized production build in `dist/`. |
| `npm run preview` | Serves the `dist/` build locally to preview the production output. Run `npm run build` first. |

---

## How to use the app

Because there is no real login, you navigate the app by **switching personas**:

1. Most screens have a **"Viewing as" dropdown** in the top bar. Pick a persona to jump into that role's screens — the sidebar updates to show only the screens that persona can access.
2. **S1 (`/s1`)** is a simulated admin login screen. Choosing a login there just sets the persona and routes you into the app (no password is checked).
3. **S15 (`/s15`)** is a standalone buyer OTP portal — enter any OTP value; nothing is validated.
4. Every screen also has a **variant switcher** (pill buttons near the top) that lets you preview different states — e.g. "normal", "empty", or edge-case flows — without needing real data.

You can also jump directly to any screen by typing its route in the URL bar, e.g. `http://localhost:5173/s10`.

---

## Project structure

```
fintech-patform-ui/
├── index.html            # HTML entry point (Vite injects the bundle here)
├── package.json          # Dependencies + npm scripts
├── vite.config.js        # Vite + React plugin config
├── tailwind.config.js    # Tailwind CSS config
├── postcss.config.js     # PostCSS (used by Tailwind)
├── wrangler.toml         # Cloudflare Pages deploy config
├── public/               # Static assets served as-is
└── src/
    ├── main.jsx          # React entry point
    ├── App.jsx           # Routes + persona-switcher wiring
    ├── routes.js         # SCREENS[], PERSONAS[], sidebar groups
    ├── index.css         # Tailwind base styles
    ├── components/
    │   ├── layout/       # Layout, TopBar, Sidebar
    │   └── kit/          # Reusable UI primitives (Button, Card, Table, …)
    ├── context/          # PersonaContext (current persona state)
    ├── data/
    │   └── mockData.js   # ALL mock data, keyed S1–S15
    ├── utils/
    │   └── format.js     # Money / date / rate formatters
    └── features/         # One folder per persona, one file per screen
        ├── admin/        # S1–S8
        ├── auditor/      # S9
        ├── investor/     # S10–S13
        ├── supplier/     # S14
        └── buyer/        # S15
```

**Where to make changes:**
- To change what data a screen shows → edit `src/data/mockData.js`.
- To change a screen's layout/logic → edit the matching file under `src/features/`.
- To change shared UI (buttons, tables, badges) → use the primitives in `src/components/kit/`.

> **Note:** Monetary values are stored in **paise** (÷100 for rupees) and interest rates in **basis points** (÷100 for %). Always format them via the helpers in `src/utils/format.js`.

---

## Screens (15)

| ID | Route | Screen | Persona |
|----|-------|--------|---------|
| S1 | `/s1` | Login + MFA | All admin |
| S2 | `/s2` | Admin dashboard | All admin |
| S3 | `/s3` | Supplier onboarding workspace | Ops Executive |
| S4 | `/s4` | Buyer management + credit review | Credit Reviewer |
| S5 | `/s5` | Invoice checks + listing approval | Ops + Treasury |
| S6 | `/s6` | Disbursement approval queue | Treasury & Settlement |
| S7 | `/s7` | Distribution + reconciliation | Treasury & Settlement |
| S8 | `/s8` | Investor invite issuance | Compliance Reviewer |
| S9 | `/s9` | Audit log | Auditor |
| S10 | `/s10` | Investor onboarding | Investor |
| S11 | `/s11` | Listing marketplace | Investor |
| S12 | `/s12` | Listing detail + subscribe | Investor |
| S13 | `/s13` | Investor portfolio + statements | Investor |
| S14 | `/s14` | Supplier portal | Supplier |
| S15 | `/s15` | Buyer portal | Buyer |

---

## Personas

Switch personas via the top-bar dropdown. Each persona sees only its own screens:

| Persona | Screens |
|---------|---------|
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

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `command not found: npm` | Node.js isn't installed. Install it from [nodejs.org](https://nodejs.org/). |
| Errors during `npm install` | Delete `node_modules/` and `package-lock.json`, then run `npm install` again. |
| `Port 5173 is already in use` | Another app (or an old dev server) is using it. Stop it, or run `npm run dev -- --port 3000` to use a different port. |
| Blank page / white screen | Check the terminal and browser console for errors. Make sure you opened the exact URL Vite printed. |
| Changes don't show up | Confirm `npm run dev` is still running. Do a hard refresh (Cmd/Ctrl + Shift + R). |
| Node version errors | Upgrade Node to 18+ (`node -v` to check). |

---

## Deployment

The app builds to a static site and is deployed to **Cloudflare Pages** (config in `wrangler.toml`).

```bash
npm run build        # outputs static files to dist/
```

The `dist/` folder can be served by any static host. `wrangler.toml` is set up for single-page-application routing so deep links (e.g. `/s10`) resolve correctly.

---

## Docs

Deeper specs live in `docs/`:

- `UI_Build_Plan.md` — overall approach and 6-step build recipe
- `STEP0_OUTPUT.md` — navigation map + screen inventory
- `STEP2_INVESTOR_BLUEPRINT.md` — investor flow spec (S10–S13)
- `STEP4_ADMIN_BLUEPRINT.md` — admin console spec (S1–S9)
- `STEP5_SUPPLIER_BUYER_BLUEPRINT.md` — supplier + buyer portal spec (S14–S15)
- `DECISION_LOG.md` — platform decision log

See also `CLAUDE.md` in the project root for detailed conventions and architecture notes.
