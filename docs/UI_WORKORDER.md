# UI WORK ORDER — current increment

> **What this is.** The single **active** UI task, scoped from the cross-repo tracker
> (`../fintech-platform-backend/docs/PROJECT_TRACKER.md` §5 Track A). Execute it **in this repo's own Claude
> session**. It is a thin checklist — the full step text lives in [`INTEGRATION_PLAN.md`](INTEGRATION_PLAN.md);
> per-screen shapes in [`API_ALIGNMENT.md`](API_ALIGNMENT.md). Don't duplicate those here.
>
> **Golden rules:** (1) backend is the source of truth — match its shapes, never reshape to suit the UI.
> (2) The **offline mock path must keep working** (`DATA_MODE=mock` default) — live wiring is additive.
> (3) `npm run build` stays green after every step.
>
> **Branch:** `feat/bridge-phase0-2` · **Updated:** 2026-07-17

---

## Increment: the bridge foundation + live login (Phase 0 + Phase 1 + Phase 2)

Goal: a browser that reaches the backend with no CORS error, a transport layer that knows the bearer + command
envelope + error shape, and **S1 login working live** for the seeded dev admins. After this, read-only screens
(S2–S8, S12, S14) become one-liners.

**Backend is ready** (BE-1…BE-12 shipped). Start it in dev before the `[needs backend]` steps:
`./mvnw spring-boot:run -Dspring-boot.run.profiles=dev` → API `:8080/api/v1`, seed password `DevPass123!`,
OTP peek `GET /dev/last-otp?email=`, ids via `GET /dev/seed-info`.

### Already done — do NOT redo
- ✅ `src/config.js` — the `DATA_MODE` / `API_BASE` / `IS_LIVE` / `IS_DEV_BACKEND` seam exists (INTEGRATION_PLAN 0.3).

### Phase 0 — Environment
- [ ] **0.2 Vite dev proxy** — `vite.config.js`: add `server.proxy` `'/api' → http://localhost:8080`
  (`changeOrigin:true`). All app calls stay **relative** (`/api/v1/...`); never hardcode the origin.
  *Accept:* with `npm run dev` + backend up, browser console `fetch('/api/v1/dev/seed-info')` returns seed ids,
  no CORS error. *(This is the only remaining Phase-0 item.)*

### Phase 1 — API client core (new `src/api/`)
- [ ] **1.1 `src/api/client.js`** — `request(method, path, {body, bearer, commandId, aggregateVersion, raw, contentType})`:
  base = `API_BASE+path`; sets `Authorization`, `Content-Type`, `X-Command-Id`, `X-Aggregate-Version` as applicable;
  JSON or raw body; parses JSON or binary; on `!res.ok` throws `ApiError`. Add a module-level
  `getBearer()`/`setBearer()` the client reads (AuthContext sets it). *(INTEGRATION_PLAN 1.1)*
- [ ] **1.2 `src/api/envelope.js`** — `newCommandId()=crypto.randomUUID()`; `postCommand`/`putCommand` (thread
  `aggregate_version`; creation commands take none); `readById`. Returns the `{aggregate_id, aggregate_version,
  emitted_events, correlation_id}` envelope. *(1.2)*
- [ ] **1.3 `ApiError` (in client.js) + `src/api/errors.js`** — carry `{status, error_code, error_category, message,
  violating_rule, violating_invariant_id, correlation_id, retryable}`; helpers `isConflict/isForbidden/isValidation`,
  `describe(e)`. Match the backend error body exactly. *(1.3)*

### Phase 2 — Auth & session (S1 live)
- [ ] **2.1 `src/api/services/auth.js`** — `loginPassword(email,password)` → `{challenge_id}`;
  `verifyOtp(challengeId,code)` → `{bearer}`; `devLastOtp(email)` (only when `IS_DEV_BACKEND`). All 🔓 open. *(2.1)*
- [ ] **2.2 `src/context/AuthContext.jsx`** — hold `{bearer, email, loginStep, challengeId}`;
  `beginLogin/completeLogin/logout`; persist `bearer`+`email` to `sessionStorage`; on change call `setBearer()`
  from client.js. **Wrap it in `src/App.jsx` OUTSIDE `PersonaProvider`.** In `mock` mode it's a no-op shim —
  never block the mock path. *(2.2)*
- [ ] **2.3 Wire S1 live** — `src/features/admin/S1.jsx`, `src/App.jsx` (`handleLogin`), `src/routes.js`
  (`LOGIN_PERSONA_MAP` → extend to the 6 dev accounts):
  - `mock` mode: keep the current variant switcher + "Login as (mock only)" dropdown **exactly as today**.
  - `live` mode: real Email/Password (default `ops@dev.local` / `DevPass123!` in dev) → `beginLogin` → `mfa` step;
    if `IS_DEV_BACKEND` auto-fill OTP via `devLastOtp(email)` → `completeLogin(code)` stores bearer; derive the UI
    persona from the email (advisory — backend enforces), call `setPersonaById`, then existing nav to first screen.
    Surface `ApiError` (bad password / disabled) inline where the mock shows the red MFA error. *(2.3)*

---

## Definition of done
1. `npm run build` green; `DATA_MODE=mock` (default) behaves **exactly as before**.
2. `[needs backend]` live check: log in as each seeded dev admin → land on the right first screen; a protected
   `GET /suppliers/{seeded}` succeeds with the stored bearer; a bad password shows an inline error.
3. **Flip the tracker** (`../fintech-platform-backend/docs/PROJECT_TRACKER.md`): S1 **Wired live** cell → ✅ (or ⚠️
   if partial), and update §0 bridge state from "not started" to "auth wired". Bump its "Last updated".
4. Commit on `feat/bridge-phase0-2`; merge to `main` when you're happy (your call).

## Notes / gotchas
- **Dev accounts (confirmed from `DevDataSeeder`):** 6 seeded admins, password `DevPass123!` —
  `super@` / `ops@` / `credit@` / `compliance@` / `treasury@` / `treasury2@` `dev.local`. The **live email→persona
  map is resolved** — 5 exact 1:1 rows (backend role = UI persona); the composite `ops-treasury` and
  `auditor`/`investor`/`supplier`/`buyer` are **intentionally not live-mapped** (documented, revisit later).
  **Canonical table: `API_ALIGNMENT.md §1.4`** (accounts also in `INTEGRATION_PLAN.md` Appendix A). Step 2.3: add a
  **new** live email→persona map for the 5 rows; leave the mock `LOGIN_PERSONA_MAP` (founder/ops_lead/credit_lead/
  auditor) untouched. Persona is advisory (UI nav only) — the backend enforces authz from the bearer's real roles.
- **DB must be up** before the `[needs backend]` steps: `docker compose up -d` in the backend repo, then
  `./mvnw spring-boot:run -Dspring-boot.run.profiles=dev`.
- `crypto.randomUUID()` is available (modern browsers / Vite dev) — use it for `X-Command-Id`.
- Keep API code under `src/api/`; no new UI component files unless a step says so (kit conventions in `CLAUDE.md`).
- 201 (created) and 200 (replayed/idempotent) both carry the envelope — treat both as success.

---

## After this increment
Next work order (replace this section's scope when you get there): **Phase 3 service layer + read-only screen
wiring** — S2 → S3 → S4 → S5 → S6 → S7 → S8 → S12 → S14 (all backend-ready). Update this file to that scope and
flip tracker cells as each screen goes live. One work order at a time.
