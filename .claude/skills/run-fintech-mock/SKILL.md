---
name: run-fintech-mock
description: Launch, run, and browser-drive the fintech mock UI in LIVE mode and screenshot it — verify a screen/widget works against the dev backend. Use when asked to run/start/screenshot the app, drive it in a browser, or confirm a UI change works live (login as a dev account, navigate, capture). Local dev (Vite on :5173 + Spring backend on :8080); drives system Chrome via playwright-core.
---

# Run the fintech mock UI (live mode, browser-driven)

A 15-screen React/Vite mock (`DATA_MODE=mock` by default) with a **live** mode that talks to the Spring
backend. To *see a change working* you run the app in **live** mode and drive a real browser: the driver
[`driver.mjs`](driver.mjs) launches the system Chrome via `playwright-core` (no browser download), logs in
through S1, and screenshots. Paths below are relative to the **repo root**.

> This is **local dev** (a developer machine + a local backend), not a headless CI container. The driver
> auto-detects Chrome on macOS/Linux; set `CHROME_PATH` if it can't.

## Prerequisites

1. **Backend running, dev profile** (seeds the 7 `*@dev.local` admins, password `DevPass123!`, OTP peek at
   `/dev/last-otp`). In the sibling repo:
   ```
   cd ../fintech-platform-backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
   ```
   Sanity: `curl -sf localhost:8080/api/v1/dev/seed-info` returns ids.
2. **Node** (repo already has deps: `npm install`) **+ a system Chrome/Chromium.**
3. **playwright-core** — install without touching `package.json`:
   ```
   npm install --no-save playwright-core
   ```

## Run (agent path)

1. Start the dev server in **live** mode (background) and wait for the port:
   ```
   VITE_DATA_MODE=live nohup npm run dev > /tmp/vite.log 2>&1 &
   for i in $(seq 1 40); do curl -sf http://localhost:5173 >/dev/null 2>&1 && break; sleep 1; done
   ```
2. Drive it:
   ```
   # Default smoke — proves the S2 "Admin & Roles" widget shows for super_admin, not for ops:
   node .claude/skills/run-fintech-mock/driver.mjs

   # Ad-hoc — log in as any admin account, open a path, screenshot:
   node .claude/skills/run-fintech-mock/driver.mjs treasury@dev.local /s6
   ```
   Screenshots land in `.claude/skills/run-fintech-mock/screenshots/` (gitignored). **Open the PNG** — a blank
   or error page means it didn't really launch.
3. Stop the dev server when done: `pkill -f vite`.

The driver's `loginAdmin(email)` covers the **admin** accounts (`super@`, `ops@`, `credit@`, `compliance@`,
`treasury@`, `treasury2@`) — fill `#email`+`#password` → **Login** → OTP auto-fills into `#otp` → **Verify** →
lands on S2 (`text=Work Queue`).

## Gotchas (specific to this app)

- **Live mode has no persona switcher.** The top bar shows a **static role label** (e.g. "Super Admin (Founder)")
  + email + **Log out**; the sidebar is derived from `/auth/session` roles (`screenIdsForSession` in `routes.js`).
  The "Viewing as" dropdown exists **only in mock mode**. Don't wait for it in live.
- **OTP auto-fills** in dev (S1 calls `/dev/last-otp`). The driver waits for `#otp` to reach 6 chars — don't type it.
- **Investor / buyer login is different** and *not* covered by `loginAdmin`: investor uses S1's
  **"Investor? Log in with email + OTP"** toggle (email-only, `investor@dev.local`); buyer is the standalone
  **/s15** portal with its own OTP screen (`ack@dev.local`). Both are passwordless.
- **React controlled inputs:** use Playwright `fill`/`type`, not `el.value = …` (won't fire onChange).
- **A `/favicon.ico` 404** in the console is expected (no icon in `index.html`) — cosmetic, ignore.
- **Must be `VITE_DATA_MODE=live`.** Plain `npm run dev` is offline mock — the app renders but never hits the
  backend, so live-only widgets/data won't appear.

## Faster check (no browser)

For API-level verification of the journeys (onboarding, deal flow, self-service, IAM), the committed harnesses
are quicker than a browser: `npm run e2e` drives all chains against the backend (see `scripts/e2e/`). Use the
browser driver when you specifically need to confirm the **rendered UI** (nav gating, a widget showing/hiding).

## Troubleshooting

- **`vite` won't start / `EADDRINUSE`** → `pkill -f vite`, then relaunch.
- **`No Chrome found`** → set `CHROME_PATH=/path/to/chrome` (or install Google Chrome / Chromium).
- **Login hangs at OTP** → the backend isn't in **dev** profile (no `/dev/last-otp`), or it's not running; check
  `curl localhost:8080/api/v1/dev/seed-info`.
- **Blank/`403` screens after login** → wrong account for the screen (live authz is role-gated); log in as the
  role that owns it, or `super@dev.local` (sees all admin screens).
