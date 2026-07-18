export const SCREENS = [
  { id: 'S1',  name: 'Login + MFA',                        path: '/s1',  group: 'Admin',    persona: 'All admin' },
  { id: 'S2',  name: 'Admin dashboard',                    path: '/s2',  group: 'Admin',    persona: 'All admin' },
  { id: 'S3',  name: 'Supplier onboarding workspace',      path: '/s3',  group: 'Admin',    persona: 'Ops Executive' },
  { id: 'S4',  name: 'Buyer management + credit review',   path: '/s4',  group: 'Admin',    persona: 'Credit Reviewer' },
  { id: 'S5',  name: 'Invoice checks + listing approval',  path: '/s5',  group: 'Admin',    persona: 'Ops + Treasury' },
  { id: 'S6',  name: 'Disbursement approval queue',        path: '/s6',  group: 'Admin',    persona: 'Treasury & Settlement' },
  { id: 'S7',  name: 'Distribution + reconciliation',      path: '/s7',  group: 'Admin',    persona: 'Treasury & Settlement' },
  { id: 'S8',  name: 'Investor invite issuance',           path: '/s8',  group: 'Admin',    persona: 'Compliance Reviewer' },
  { id: 'S9',  name: 'Audit log',                          path: '/s9',  group: 'Auditor',  persona: 'Auditor' },
  { id: 'S10', name: 'Investor onboarding',                path: '/s10', group: 'Investor', persona: 'Investor' },
  { id: 'S11', name: 'Listing marketplace',                path: '/s11', group: 'Investor', persona: 'Investor' },
  { id: 'S12', name: 'Listing detail + subscribe',         path: '/s12', group: 'Investor', persona: 'Investor' },
  { id: 'S13', name: 'Investor portfolio + statements',    path: '/s13', group: 'Investor', persona: 'Investor' },
  { id: 'S14', name: 'Supplier portal',                    path: '/s14', group: 'Supplier', persona: 'Supplier' },
  { id: 'S15', name: 'Buyer portal',                       path: '/s15', group: 'Buyer',    persona: 'Buyer' },
]

export const PERSONAS = [
  { id: 'super-admin',         name: 'Super Admin (Founder)', accessibleScreens: ['S1','S2','S3','S4','S5','S6','S7','S8'] },
  { id: 'ops-executive',       name: 'Ops Executive',         accessibleScreens: ['S1','S2','S3'] },
  { id: 'credit-reviewer',     name: 'Credit Reviewer',       accessibleScreens: ['S1','S2','S4'] },
  { id: 'ops-treasury',        name: 'Ops + Treasury',        accessibleScreens: ['S1','S2','S3','S5','S6','S7'] },
  { id: 'treasury-settlement', name: 'Treasury & Settlement', accessibleScreens: ['S1','S2','S6','S7'] },
  { id: 'compliance-reviewer', name: 'Compliance Reviewer',   accessibleScreens: ['S1','S2','S8'] },
  { id: 'auditor',             name: 'Auditor',               accessibleScreens: ['S9'] },
  { id: 'investor',            name: 'Investor',              accessibleScreens: ['S10','S11','S12','S13'] },
  { id: 'supplier',            name: 'Supplier',              accessibleScreens: ['S14'] },
  { id: 'buyer',               name: 'Buyer',                 accessibleScreens: ['S15'] },
]

export const SIDEBAR_GROUPS = ['Admin', 'Auditor', 'Investor', 'Supplier', 'Buyer']

// Live mode: the screens a session may reach, derived directly from the backend's roles[]/kind — no persona.
// Inclusive by design (a screen a role partly acts on is shown; the backend enforces the real per-action authz,
// so a step you lack the role for still 403s inline). Edit this table to change who sees what.
const ROLE_SCREENS = {
  super_admin:             ['S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S10', 'S14'],
  ops_executive:           ['S2', 'S3', 'S4', 'S5', 'S7', 'S10', 'S14'],
  credit_reviewer:         ['S2', 'S3', 'S4'],
  compliance_reviewer:     ['S2', 'S3', 'S8', 'S10'],
  treasury_and_settlement: ['S2', 'S5', 'S6', 'S7'],
  auditor:                 ['S9'],
}

// Screen ids a live session can reach — union of its roles' screens (+ kind for non-admins). The Sidebar reads
// this in live mode instead of a persona's fixed accessibleScreens.
export function screenIdsForSession(session) {
  if (!session) return []
  if (session.kind === 'investor') return ['S11', 'S12', 'S13']
  if (session.kind === 'acknowledgment_user') return ['S15']
  const set = new Set()
  for (const r of session.roles ?? []) (ROLE_SCREENS[r] ?? []).forEach(s => set.add(s))
  return [...set]
}

// Maps persona id → queue role keys in mockData.S2.queues
export const PERSONA_ROLES = {
  'super-admin':         ['super_admin', 'ops_executive', 'credit_reviewer', 'compliance_reviewer', 'treasury_and_settlement'],
  'ops-executive':       ['ops_executive'],
  'credit-reviewer':     ['credit_reviewer'],
  'ops-treasury':        ['ops_executive', 'treasury_and_settlement'],
  'treasury-settlement': ['treasury_and_settlement'],
  'compliance-reviewer': ['compliance_reviewer', 'super_admin'],
  'auditor':             [],
  'investor':            [],
  'supplier':            [],
  'buyer':               [],
}

// Maps backend work-queue NAME (BE-12 /admin/work-queues, counts-only) → target screen (live dashboard).
export const QUEUE_NAME_SCREEN = {
  supplier_kyc_review:    '/s3',
  supplier_credit_review: '/s4',
  investor_kyc_review:    '/s8',
  listing_ops_checks:     '/s5',
  listing_golive_review:  '/s5',
  disbursement_approval:  '/s6',
  distribution_approval:  '/s7',
}

// Maps queue item type → target screen path
export const QUEUE_SCREEN = {
  supplier_onboarding: '/s3',
  invoice_check:       '/s5',
  listing_golive:      '/s5',
  buyer_credit:        '/s4',
  supplier_credit:     '/s4',
  kyc_approval:        '/s8',
  invite_issuance:     '/s8',
  disbursement:        '/s6',
  user_management:     '/s2',
}

// Maps S1 persona ids (mockData) → routes.js persona ids. Used by the MOCK login only — leave untouched.
export const LOGIN_PERSONA_MAP = {
  founder:     'super-admin',
  ops_lead:    'ops-treasury',
  credit_lead: 'credit-reviewer',
  auditor:     'auditor',
}

// LIVE login: seeded dev-account email → UI persona. Backend role = UI persona, exactly 1:1
// (canonical mapping: mock docs/API_ALIGNMENT.md §1.4). The other 5 personas are intentionally not live-mapped.
// Persona is advisory (UI nav/sidebar scope only) — the backend enforces authz from the bearer's real roles.
// Derive the UI persona (sidebar/nav grouping) from the live session — NOT from the email. The backend is the
// source of truth for identity: `GET /auth/session` returns `kind` + `roles[]`, so any email/account works.
// Persona is advisory (which screens are shown); the backend enforces the real authz (role gates + own-id/tenant
// scoping) from the bearer. Backend role strings ↔ UI persona ids:
//   super_admin→super-admin · ops_executive→ops-executive · credit_reviewer→credit-reviewer
//   compliance_reviewer→compliance-reviewer · treasury_and_settlement→treasury-settlement · auditor→auditor (M17)
// kind investor→investor · acknowledgment_user→buyer. A multi-role admin resolves to the broadest fit
// (ops+treasury→ops-treasury); edge cases can still be switched via the "Viewing as" dropdown.
export function personaFromSession(session) {
  if (!session) return 'ops-executive'                              // nav-only fallback (backend still enforces authz)
  if (session.kind === 'investor') return 'investor'
  if (session.kind === 'acknowledgment_user') return 'buyer'
  const roles = session.roles ?? []
  const has = r => roles.includes(r)
  if (has('super_admin')) return 'super-admin'
  if (has('auditor')) return 'auditor'                              // forward-compatible (M17 not built yet)
  if (has('ops_executive') && has('treasury_and_settlement')) return 'ops-treasury'
  if (has('compliance_reviewer')) return 'compliance-reviewer'
  if (has('credit_reviewer')) return 'credit-reviewer'
  if (has('treasury_and_settlement')) return 'treasury-settlement'
  if (has('ops_executive')) return 'ops-executive'
  return 'ops-executive'
}
