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
export const LIVE_LOGIN_PERSONA_MAP = {
  'super@dev.local':      'super-admin',
  'ops@dev.local':        'ops-executive',
  'credit@dev.local':     'credit-reviewer',
  'compliance@dev.local': 'compliance-reviewer',
  'treasury@dev.local':   'treasury-settlement',
  'treasury2@dev.local':  'treasury-settlement',
}
