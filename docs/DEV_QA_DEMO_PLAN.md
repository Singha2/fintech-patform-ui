# Dev-Profile QA + Demo Plan (local)

Goal: bring the app up on the **live dev backend**, create data for every screen, walk each journey, and be ready
to demo to the Founder. ~30 min. Dev **admins** log in with password **`DevPass123!`**; the **investor** logs in
**passwordless** (email + OTP, §6). The OTP **auto-fills** in dev either way.

---

## 1. Start it up

1. **Backend** (seeds 7 admins + 1 supplier/buyer/investor + a pricing band on first boot):
   ```
   cd fintech-platform-backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
   ```
   Wait for `Started ... Application`.
2. **UI — must be live mode** (default is offline mock; if you skip `VITE_DATA_MODE=live` you are NOT hitting the backend):
   ```
   cd fintech-patform-mock && npm install && VITE_DATA_MODE=live npm run dev
   ```
   Open http://localhost:5173.
3. **Sanity:** `curl -s localhost:8080/api/v1/dev/seed-info` returns ids → you're good.

---

## 2. Two things to know

- **"Viewing as" dropdown** (top bar) = which **screens** you see.
- **The account you logged in as** = what you're allowed to **do**. A **403** means wrong role.
- **To switch account** (there's no logout button yet): open the login screen at **http://localhost:5173/s1** and log in as the needed account — the new login **replaces** the session.

| Log in as | Role | Drives |
|---|---|---|
| `ops@dev.local` | Ops | create / identity / KYC-submit / financial / MIA / activate, ops-checks, record-maturity |
| `ops2@dev.local` | Ops (2nd) | **Document Completeness** check (DOC.3 needs a *different* ops than who uploaded) |
| `compliance@dev.local` | Compliance | issue invite, suitability, KYC approve |
| `credit@dev.local` | Credit | buyer credit assessment |
| `treasury@dev.local` | Treasury | go-live approve, disbursement (maker), distribution (draft) |
| `treasury2@dev.local` | Treasury (2nd) | disbursement approve, distribution approve (checker ≠ maker) |
| `investor@dev.local` | Investor (self-service) | **passwordless** login (email + OTP, *no password*) — browse, self-subscribe, portfolio → see §6 |

---

## 3. Seed money-flow data (once — populates marketplace, disbursement, distribution, portfolio)

Paste in a terminal:
```
for s in live live disbursable disbursed matured; do \
  curl -s -X POST localhost:8080/api/v1/dev/seed-listing -H 'Content-Type: application/json' -d "{\"stage\":\"$s\"}" >/dev/null; done
```
Now S11 (marketplace), S6 (disbursement queue), S7 (distribution), S13 (portfolio) have rows.

---

## 4. Walk the journeys (tick each)

**A. Login & dashboard**
- [ ] Log in `ops@` → lands on **S2**; tiles + queue counts show numbers.

**B. Onboarding** (creates data + shows the role hand-offs)
- [ ] **Supplier (S3):** `ops@` Create supplier → Identity → Submit KYC → **login `compliance@`** Approve KYC → **login `credit@`** Credit Review → **login `ops@`** MAA → Activate → **Active**.
- [ ] **Buyer (S4):** `ops@` Nominate → Identity → **`credit@`** Credit Assessment → **`ops@`** Engagement → Activate → **Active**.
- [ ] **Investor invite (S8):** **`compliance@`** Issue Invite → shows in the list.
- [ ] **Investor onboarding (S10):** `ops@` Sign Up (pick the pending invite; enter email/phone) → Identity → Submit KYC → **`compliance@`** Assess Suitability → **`ops@`** Financial Profile → **`compliance@`** Approve KYC → **`ops@`** MIA → Activate → **Active**.

**C. Deal flow — the hero demo**
- [ ] **Go-live (S5):** `ops@` Create listing → record the checks → **Upload Invoice PDF** (any PDF) → **login `ops2@`** record **Document Completeness** → **`ops@`** finish checks → Send to Listing Approval → **login `treasury@`** Approve Go-Live → listing **Live**.
- [ ] **Subscribe (S12):** open a live listing (via **S11**) → enter an amount → Commit → committed total rises.
- [ ] **Disburse (S6):** **`treasury2@`** → open the drafted disbursement → Approve → **Disbursed**.
- [ ] **Maturity + distribution (S7):** **`ops@`** Record Maturity → **`treasury@`** Draft Distribution → **login `treasury2@`** Approve → **Distributed**.

**D. Investor portal** (full self-service journey is **§6** — this is the quick admin-side view)
- [ ] **Portfolio (S13):** switch **Viewing as → Investor** → positions, summary tiles, and TDS show.
- [ ] **Marketplace (S11):** live listings are listed.

**E. Read-only / still mock**
- [ ] **S14** supplier tracker — read.
- [ ] **S9** auditor & **S15** buyer portal — **mock/deferred**; show as placeholders, don't test as live.

---

## 5. Founder demo (10 min, happy path)
Two acts:
1. **Platform runs a deal** (admin): login → **S2** dashboard → one **supplier onboarding (S3)** → **go-live (S5)** → **disburse (S6)** → **distribute (S7)**.
2. **A real investor invests** (self-service): open **/s1** → **investor login** (email + OTP, §6) → **S11** browse → **S12** subscribe → **S13** portfolio — no Ops in the loop.

---

## 6. Investor self-service (BE-18 — live)
A real investor logs in with **email + OTP (no password)** and subscribes **as themselves**.
- [ ] **Investor login:** on the login screen click **"Investor? Log in with email + OTP →"** → email `investor@dev.local` → **Send OTP** (auto-fills in dev) → **Verify & Enter** → lands on **S11 (marketplace)**.
- [ ] **Self-subscribe (S12):** open a live listing → enter an amount → **Commit** → committed total rises; the position appears in **S13** (My Portfolio) — no Ops involved.
- [ ] **Scoping (optional):** the investor only ever sees their **own** portfolio (backend rejects any cross-account read/commit → 403).

_Ops-on-behalf still works: an admin can also subscribe for an investor from S12 — no change to the admin flow._

---

## Tips
- **403?** Wrong role — open **/s1** and log in as the account the step names (re-login replaces the session; there's no logout button yet).
- **Screen empty?** Either run the seed in §3, or you haven't yet driven the journey that creates that data.
- **OTP** auto-fills in dev; if it doesn't, `curl "localhost:8080/api/v1/dev/last-otp?email=<the-email>"`.
- **Reset:** restarting the backend keeps data (idempotent). For a clean slate, ask the backend team to drop the dev DB.
