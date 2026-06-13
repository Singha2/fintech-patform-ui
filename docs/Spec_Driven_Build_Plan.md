# Spec-Driven Build Plan — Fintech Invoice-Discounting Platform

**Owner:** Single developer + Claude · **Target:** Full regulated production (Phase 1)
**Method:** GitHub Spec Kit (`/constitution → /specify → /clarify → /plan → /tasks → /implement`)
**Created:** 2026-06-13

> How to read this doc: Sections A–C are decisions (read once). Section D is the loop you
> repeat for every module. Sections E–G are the reusable gates (DoR / DoD / Production).
> Section H is the build order. Section I is your day-to-day cadence.

---

## A. North Star & Ground Rules

- **Definition of Phase-1 "done":** full regulated production — real counterparties, real money, real audit/compliance obligations. Every module must pass the Production Readiness gate (Section G), not just "it works on my machine."
- **You are one developer + Claude.** Optimise for: small vertical slices, ruthless reuse of the schema you already designed, automation over ceremony, and never building two things at once.
- **The SQL bundle is the schema source of truth.** It already encodes domain invariants (CHECK constraints, enums, triggers, maker-checker columns, `aggregate_version`). The app layer mirrors these rules earlier with better errors; the DB stays the last line of defence. **Do not let Hibernate generate the schema.**
- **Every state change is:** (1) maker-checker gated, (2) MFA-fresh, (3) SoD-checked, (4) idempotent on `command_id`, (5) audit-logged via the immutable chained envelope. These five are non-negotiable and belong in the Constitution.
- **Money is paise (BIGINT). Rates are bps. Never floats.** Time is `TIMESTAMPTZ`.
- **One module in flight at a time.** Finish to DoD before starting the next.

---

## B. Target Architecture & Repos

- **`fintech-patform-mock` (this repo) → the Frontend.** Stays as-is now; evolves into the production React + TypeScript app. The 15 mock screens are the *frontend contract* — each backend module must satisfy the screen(s) that consume it.
- **`fintech-platform-backend` (new repo) → the Backend.** Java + Spring Boot monolith, PostgreSQL, Flyway. **Spec Kit is initialised here.** Bounded contexts enforced in-code with **ArchUnit** (no cross-BC table joins; coordinate via in-process events + identity references).
- **Domain docs travel with the backend.** Copy into the backend repo as the Spec Kit corpus:
  - `Bounded_Contexts_Reference.md` (the 19 BCs)
  - `domain_entity_responsibility.md` (the data dictionary)
  - the `SQL/SQL_Files_Bundle/` (4 files → Flyway migrations)
  - the platform Decision Log (DL-001…050), Constraints (C1–C28), Gap Log (G…)
  - the blueprints (STEP2 / STEP4 / STEP5) — they describe both flows and rules.
- **Persistence approach:** **Flyway** (port the 4 SQL files into versioned migrations) + **JPA/Hibernate** mapping onto the existing schema. Reach for **jOOQ or native SQL** for the invariant-heavy reads (funding equality, reconciliation). Hibernate `ddl-auto=validate` only — never `create`/`update`.
- **Integrations are stubbed behind ACL ports (BC17/18/19 + BC15).** Real interfaces, fake in-process adapters (deterministic webhooks, fake UTRs/assertions). Swap real sandboxes → production credentials at the Production gate.

---

## C. Logical Module Register

Each module = one Spec Kit feature with its **own DoR**. Grouped where rigor is low, individual where money/legal risk is high. Built in the order of Section H.

**Wave 0 — Platform Foundation** (must exist before any feature):
- **M0 · Platform Bootstrap & Persistence** — Spring skeleton, Flyway port of the SQL bundle, config/secrets, CI/CD, structured logging + metrics + tracing baseline, ArchUnit harness.
- **M1 · Shared Kernel & Event Backbone** — money/paise & bps value objects, ID types, `aggregate_version` optimistic-locking pattern, in-process event bus (pub/sub), unified error model, idempotency store (`command_id`).
- **M2 · Audit Log (BC14)** — immutable, cryptographically-chained `sys_audit_event` envelope; append-only enforced at DB; every other module depends on it.
- **M3 · Auth & Identity** — `auth_identity / credential / mfa_factor / otp_challenge / session`; MFA freshness (`mfa_assertion_id`), tenant claims, session lifecycle.
- **M4 · Admin IAM + Maker-Checker + SoD (BC10, BC16)** — `admin_user / role_assignment / sod_policy / deviation_log`; the maker-checker engine and SoD enforcement every command routes through.
- **M5 · Integration ACLs — stubbed (BC15/17/18/19)** — Verification (PAN/Aadhaar/GST/IRN/bureau), Banking/Escrow (VA, payouts, inflow webhooks), e-Sign, Notifications (email/SMS). Real ports, fake adapters.

**Wave 1 — Core Money Flow** (each its own feature, maximum rigor):
- **M6 · Credit & Underwriting (BC3)** — buyer/supplier profiles, pricing policy, four-eyes overrides, default classification. (Needed before a listing can snapshot pricing.)
- **M7 · Supplier Onboarding (BC8)** — supplier account, agency consent, financial profile (admin acts-on-behalf; no supplier login Phase 1).
- **M8 · Buyer Management (BC9)** — buyer account, per-invoice acknowledgment user (OTP-only), payment rules.
- **M9 · Listing & Invoice (BC1)** — invoice intake, ops checks, the listing state machine, pricing snapshot at `ready_for_review`, go-live (Treasury maker-checker + MFA).
- **M10 · Investor Onboarding (BC7)** — invite → signup → KYC → suitability → active.
- **M11 · Subscription (BC2)** — investor commitment lifecycle, ₹10K min, funding equality (G10), pre-confirmation cancellation, refunds.
- **M12 · Assignment & Signing (BC5)** — assignment set on 100%-funded, per-investor master agreement, e-sign, `AllSigned` → disbursement gate.
- **M13 · Settlement (BC4)** — VA creation, disbursement + distribution instructions, TDS snapshot, reconciliation engine, remediation queue.

**Wave 2 — Collections & Oversight:**
- **M14 · Collections & Recovery (BC6)** — maturity tracking, buyer inflow, collections actions, claim adjudication.
- **M15 · Compliance (BC11)** — KYC approval/rejection, AML/PEP screening, SAR cases, re-screening scheduler. (Walking-skeleton stub = auto-approve; full engine here.)
- **M16 · Tax & Reporting (BC12)** — TDS rate/amount, year profile, investor statements.
- **M17 · Auditor Access (BC13)** — time-bound read-only auditor accounts, access scopes, auto-disable.

---

## D. The Per-Module Loop (repeat for every module M0–M17)

> This is the core cycle. Each step maps to a Spec Kit command or a gate.

1. **Pick the module** from Section H's order. Confirm its upstream deps are Done or stubbed.
2. **`/specify`** — write the spec from the BC doc + blueprint + relevant screens. *What and why*, not how. State the user journeys and rules.
3. **`/clarify`** — let Spec Kit interrogate ambiguities; resolve every open question. (Pull answers from the Decision Log / Constraints / Gap Log.)
4. **Pass the DoR gate (Section E).** If any DoR item is unchecked, you are not ready to plan — go back to step 2/3. **No coding before DoR is green.**
5. **`/plan`** — tech plan: Flyway migration version, JPA mappings, aggregates, commands/queries, events, ACL ports, maker-checker/SoD/MFA touchpoints, audit events, API contract for the frontend.
6. **`/tasks`** — generate the ordered task list. Re-order so tests come with (not after) each behavior.
7. **`/implement`** — build task by task. Write the invariant tests first where a CHECK constraint or domain rule exists.
8. **Verify against the DoD gate (Section F).** Run `/code-review` (Claude) on the diff; fix findings.
9. **Deploy to staging**, smoke-test the slice end-to-end, update the spec to "as-built" + add Decision Log entries.
10. **Stop.** Do not start the next module until this one is at DoD.

---

## E. Definition of Ready (DoR) — gate before `/plan`

> Copy this checklist into each module's spec. Every box must be ticked.

- [ ] **Scope & boundary** — which BC(s), aggregates, and tables this module owns (no overlap with another module).
- [ ] **Upstream dependencies** — listed, and each is Done or has an agreed stub.
- [ ] **Domain rules & invariants enumerated** — with DL-/C-/G- references from the docs.
- [ ] **Schema mapped** — exact tables/enums/constraints from the SQL bundle identified; Flyway migration version reserved.
- [ ] **Events** — published and subscribed events listed with payload shape.
- [ ] **ACL contracts** — any external dependency expressed as a port (interface) with a stub adapter.
- [ ] **API surface drafted** — commands (state-changing) and queries (read-only) named.
- [ ] **Control rules identified** — maker-checker pairs, SoD blocks, MFA-freshness points, idempotency key.
- [ ] **Audit events identified** — every state change names the envelope it emits.
- [ ] **Frontend contract** — which mock screen(s) consume this; API request/response shapes agreed.
- [ ] **Test scenarios enumerated** — happy path + invariant violations + maker-checker reject + idempotent retry + SoD block.
- [ ] **Acceptance criteria** — measurable, written, agreed.
- [ ] **All `/clarify` questions resolved** — zero open ambiguities.

---

## F. Definition of Done (DoD) — gate per module (regulated production)

- [ ] All tasks complete; diff passes Claude `/code-review` with findings fixed.
- [ ] **Unit + integration tests green**; invariant tests prove both the app-level rule *and* the DB constraint fire.
- [ ] **Contract tests** pass against the consuming frontend screen(s) / downstream modules.
- [ ] **Maker-checker, SoD, MFA-freshness** enforced and tested (including the reject paths).
- [ ] **Every state change emits an audit envelope**; chain integrity verified.
- [ ] **Idempotency verified** — replaying a `command_id` is a no-op.
- [ ] **Flyway migration** applies cleanly forward; rollback strategy documented.
- [ ] **Security** — authz at the command boundary, input validation, no secrets in code, dependency scan clean.
- [ ] **Observability** — structured logs, metrics, traces, and at least one alert for the module's critical path.
- [ ] **Docs updated** — spec/plan/tasks marked as-built; Decision Log entries added.
- [ ] **Deployed to staging** and smoke-tested in the running system.

---

## G. Production Readiness Gate (whole platform, once, before go-live)

- [ ] **Security review + external penetration test** passed.
- [ ] **Load / performance test** at expected peak; reconciliation under concurrency proven.
- [ ] **DR & backups** — automated, tested restore; RPO/RTO defined.
- [ ] **Audit retention** — WORM storage verified, 10-year retention configured (C1/DL-040).
- [ ] **Compliance checklist** — data residency, DPDP Act, and applicable RBI/SEBI obligations reviewed with counsel.
- [ ] **Vendors switched** — sandbox → production credentials; live reconciliation tested with the real escrow partner on a controlled amount.
- [ ] **Runbooks + incident process + on-call** for money-movement failures and remediation cases.
- [ ] **UAT** with a small set of real counterparties on a controlled flow before opening the marketplace.

---

## H. Build Sequence

### Phase 0 — Bootstrap (do first, once)
1. Create `fintech-platform-backend` repo; Spring Boot + PostgreSQL + Flyway skeleton.
2. Install Spec Kit (`uvx --from git+https://github.com/github/spec-kit.git specify init`) and run **`/constitution`** — encode Section A's non-negotiables + money/bps + audit + maker-checker/SoD/MFA + tenant isolation + testing gates.
3. Copy domain docs (Section B) into the backend repo.
4. Port the 4 SQL files into Flyway migrations; stand up the schema; wire ArchUnit + CI.

### Milestone 1 — Walking Skeleton (highest-value first build)
- Build the **thin vertical slice** that takes one invoice from **listed → disbursed**, touching the foundation (M0–M5) plus *just enough* of M6–M13, with Compliance auto-approved and all vendors stubbed:
  - Admin logs in (M3/M4) → Supplier onboarded (M7 min) → Buyer + ack user (M8 min) → Invoice listed & gone live (M9) → Investor onboarded & subscribes to 100% (M10/M11 min) → assignment "signed" via stub (M12) → disbursement instruction settles via stubbed escrow (M13) → audit envelopes throughout (M2).
- This proves the hardest invariants early: maker-checker, MFA freshness, funding equality (G10), idempotency, audit chaining.

### Milestone 2 — Widen Wave 1 to full rigor
- Take each of M6–M13 from "skeleton-thin" to its complete spec (all state-machine paths, all invariants, all reject paths), one module at a time, each to DoD.

### Milestone 3 — Wave 2 oversight
- M14 Collections → M15 Compliance (replace the auto-approve stub) → M16 Tax → M17 Auditor Access.

### Milestone 4 — Production hardening
- Swap stubs for real vendor sandboxes, then production; run Section G; UAT; go live.

---

## I. Solo-Dev Operating Cadence (how you + Claude run this)

- **One module in flight.** WIP limit = 1. Resist starting M(n+1) before M(n) hits DoD.
- **Spec first, always.** The most expensive bug is a wrong spec. Spend real time in `/specify` + `/clarify`; let the DoR gate stop you.
- **Let the DB and tests carry correctness.** You already encoded invariants in SQL — write the test that proves both the constraint and the app rule, then implement.
- **Use Claude for:** drafting specs from the BC docs, generating Flyway migrations from the SQL bundle, implementing tasks, `/code-review` on every diff, and writing invariant tests. Use yourself for: judgment on rules, the clarify answers, and the DoD/Production gates.
- **Keep the Decision Log alive.** Every non-obvious choice or bug → one entry. Future-you and Claude both read it.
- **Frontend follows backend per slice.** As each module reaches DoD, wire the real API into the matching mock screen — the mock becomes the production frontend incrementally.

---

*Next concrete step:* create the backend repo and run Phase 0 (bootstrap + `/constitution` + Flyway port). When ready, ask Claude to scaffold it and draft the constitution from Section A.
