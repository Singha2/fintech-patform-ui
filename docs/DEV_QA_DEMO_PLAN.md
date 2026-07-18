# Dev-Profile QA + Demo Plan (local)

Goal: bring the app up on the **live dev backend**, walk **every** user journey, and be ready to demo to the
Founder. ~40 min. **14 of 15 screens are live** (only S9 audit log is mock — awaits backend M17).

Dev **admins** log in with password **`DevPass123!`**; the **investor** and **buyer** log in **passwordless**
(email + OTP). The OTP **auto-fills** in dev. To switch account: click **Log out** (top bar), then log back in.

---

## 1. Start it up

1. **Backend** (seeds 7 admins + 1 active supplier/buyer/investor + ack-user + pricing band on first boot):
   ```
   cd fintech-platform-backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
   ```
   Wait for `Started ... Application`.
2. **UI — must be live mode** (default is offline mock; skip `VITE_DATA_MODE=live` and you're NOT hitting the backend):
   ```
   cd fintech-patform-mock && npm install && VITE_DATA_MODE=live npm run dev
   ```
   Open http://localhost:5173.
3. **Sanity:** `curl -s localhost:8080/api/v1/dev/seed-info` returns ids → you're good.

---

## 2. Two things to know

- **The sidebar shows your role's screens** — in live mode there's **no "Viewing as" switcher**; nav is driven
  straight from the account's backend roles (the top bar shows your role + email). *(The persona switcher exists
  only in offline mock mode.)*
- **The account you logged in as** = what you can see **and** do. A **403** means wrong role → click **Log out**
  (top bar) and log in as the account the step names. To act as a different principal, log out and log back in.

| Log in as | How | Drives |
|---|---|---|
| `ops@dev.local` | password | create/identity/KYC-submit/financial/MIA/activate, ops-checks, **invoice origination (S14)**, record-maturity |
| `ops2@dev.local` | password | **Document Completeness** check (DOC.3 needs a *different* ops than who uploaded) |
| `compliance@dev.local` | password | issue invite, suitability, KYC approve |
| `credit@dev.local` | password | buyer nominate + credit assessment |
| `treasury@dev.local` | password | go-live approve, disbursement (maker), distribution (draft) |
| `treasury2@dev.local` | password | disbursement approve, distribution approve (checker ≠ maker) |
| `investor@dev.local` | **email + OTP** | investor self-service — browse, self-subscribe, portfolio (§5) |
| `ack@dev.local` | **email + OTP** | buyer self-service — acknowledge invoices (§6) |

---

## 3. (Optional) Seed money-flow data fast

The full deal flow (§4C) is clickable end-to-end, but to populate the money-flow screens instantly for a demo:
```
for s in live live disbursable disbursed matured; do \
  curl -s -X POST localhost:8080/api/v1/dev/seed-listing -H 'Content-Type: application/json' -d "{\"stage\":\"$s\"}" >/dev/null; done
```
Now S11 (marketplace), S6 (disbursement queue), S7 (distribution), S13 (portfolio) have rows without hand-driving.

---

## 4. Walk the journeys (tick each)

### A. Login & dashboard
- [ ] Log in `ops@` → lands on **S2**; tiles + queue counts show numbers.

### B. Counterparty onboarding (shows the SoD role hand-offs)
- [ ] **Supplier (S3):** `ops@` Create → Identity → Submit KYC → **`compliance@`** Approve KYC → **`credit@`** Credit Review → **`ops@`** MAA → Activate → **Active**.
- [ ] **Buyer (S4):** **`credit@`** Nominate → **`ops@`** Identity → **`credit@`** Credit Assessment → **`ops@`** Engagement → Ack-user + Payment → Activate → **Active**.
- [ ] **Investor invite (S8):** **`compliance@`** Issue Invite → shows in the list.
- [ ] **Investor onboarding (S10):** `ops@` Sign Up (pick the pending invite; enter email/phone) → Identity → Submit KYC → **`compliance@`** Assess Suitability → **`ops@`** Financial Profile → **`compliance@`** Approve KYC → **`ops@`** MIA → Activate → **Active**.

### C. Deal lifecycle — the hero (invoice → cash → returns)
- [ ] **Originate invoice (S14):** as `ops@`, open **S14 Supplier Portal** in the sidebar → **Upload Invoice** tab → pick a buyer, enter face value (paise), date, tenor, optionally attach a PDF → **Submit Invoice** → the invoice appears in the tracker (`draft`). *(Acting-as supplier under agency consent — an Ops action, so it's in the Ops sidebar.)*
- [ ] **Go-live (S5):** the new invoice is in the **Invoice Checks** tab → record the checks → **Upload Invoice PDF** (if not attached in S14) → **login `ops2@`** record **Document Completeness** (DOC.3) → **`ops@`** finish checks → Send to Listing Approval → **login `treasury@`** Approve Go-Live → **Live**.
- [ ] **Subscribe (S12):** open the live listing (via **S11**) → enter an amount → Commit → committed total rises.
- [ ] **Disburse (S6):** **`treasury2@`** → open the drafted disbursement → Approve → **Disbursed**.
- [ ] **Maturity + distribution (S7):** **`ops@`** Record Maturity → **`treasury@`** Draft Distribution → **login `treasury2@`** Approve → **Distributed**.

### D. Investor self-service → **see §5**
### E. Buyer self-service → **see §6**

### F. Read / audit
- [ ] **S13 portfolio + S11 marketplace**: log in as the **investor** (§5) → S11 lists live listings, S13 shows positions + summary + TDS. *(These are investor-role screens — reached by logging in as the investor, not a persona switch.)*
- [ ] **S14 tracker**: the supplier's invoices + funding progress.
- [ ] **S16 Admin & Roles** (super_admin only): log in as `super@` → **Admin & Roles** in the sidebar → **Provision** a new admin (email/name/phone) → copy the returned id → **Assign Role**. A soft-SoD role pair prompts for an override reason. *(Not in any other role's sidebar; non-super → 403.)*
- [ ] **S9 audit log** — **mock/deferred** (backend M17 not built); show as a placeholder, don't test live.

---

## 5. Investor self-service (BE-18 — live)
A real investor logs in and invests **as themselves** — no Ops in the loop.
- [ ] **Login:** on the login screen click **"Investor? Log in with email + OTP →"** → `investor@dev.local` → **Send OTP** (auto-fills) → **Verify** → lands on **S11 (marketplace)**.
- [ ] **Subscribe (S12):** open a live listing → amount → **Commit** → the position appears in **S13** (My Portfolio).
- [ ] **Scoping:** the investor only ever sees their **own** portfolio (a cross-account read/commit → 403).

_Ops-on-behalf still works: an admin can also subscribe for an investor from S12._

---

## 6. Buyer self-service (BE-15 — live)
The buyer's ack-user logs in and acknowledges their own invoices.
- [ ] **Prereq:** an invoice **awaiting acknowledgment**. In **S5**, on a listing that passed ops-checks, click **Send Ack Request** (leaves it pending for the buyer).
- [ ] **Login:** go to **/s15** (the buyer portal is a standalone screen) → its login shows `ack@dev.local` prefilled → **Send OTP** (auto-fills) → **Verify** → the buyer portal opens.
- [ ] **Acknowledge (S15):** the pending invoice is listed → **Acknowledge** → Confirm → status → **acknowledged** (S5 now reflects it — the go-live can proceed).
- [ ] **Scoping:** the buyer only sees their **own** invoices (a cross-account read → 403).

_Ops-on-behalf still works: Ops can record the buyer ack from S5 instead._

---

## 7. Founder demo (12 min, happy path)
Three acts, no mocks:
1. **Platform originates & runs a deal** (admin): login → **S2** → **originate an invoice (S14)** → **go-live (S5)** → **disburse (S6)** → **distribute (S7)**.
2. **A real investor invests** (self-service): **Log out** → **investor login** (§5) → **S11** browse → **S12** subscribe → **S13** portfolio.
3. **A real buyer acknowledges** (self-service): **Log out** → **buyer login** (§6) → **S15** acknowledge an invoice.

---

## Tips
- **403?** Wrong role — **Log out** (top bar) and log in as the account the step names.
- **Screen empty?** Run the optional seed (§3), or you haven't yet driven the journey that creates that data.
- **OTP** auto-fills in dev; if not, `curl "localhost:8080/api/v1/dev/last-otp?email=<the-email>"`.
- **Reset:** restarting the backend keeps data (idempotent). For a clean slate, ask the backend team to drop the dev DB.
- **Regression suite:** `npm run e2e` drives all 10 journey chains against the backend (112 checks) — run it before a demo.
