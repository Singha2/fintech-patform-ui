// ─────────────────────────────────────────────────────────────────────────────
// SOURCE OF TRUTH: the backend (fintech-platform-backend, served under /api/v1).
// This file is a UI stand-in for that API. Field names, enum values, and command
// envelopes below are aligned to the real endpoints — see docs/API_ALIGNMENT.md
// for the full screen→endpoint→shape mapping and the read-side gap register.
//
// Two data kinds live here:
//   • API-shaped   — objects whose fields/enums match a real endpoint (live-swap targets).
//   • UI-composed  — data the backend does NOT yet expose; kept so screens render,
//                    flagged `// GAP Gx` (x = the gap id in API_ALIGNMENT.md §4).
//
// Command responses from the backend are the envelope below (NOT the entity); after
// a write the UI must re-read GET …/{id} and carry the new aggregate_version forward.
// ─────────────────────────────────────────────────────────────────────────────
const API_COMMAND_ENVELOPE_SHAPE = {
  aggregate_id: 'uuid',
  aggregate_version: 0,
  emitted_events: [{ event_id: 'uuid', event_type: 'Some.Event', occurred_at: 'ISO-8601' }],
  correlation_id: 'uuid',
}

const mockData = {

  // Documents the shape every command endpoint returns (see API_ALIGNMENT.md §1.2).
  _apiCommandEnvelope: API_COMMAND_ENVELOPE_SHAPE,

  // ── S1 — Login ────────────────────────────────────────────────
  // API: two-step OTP flow — POST /auth/login/password {email,password} → {challenge_id};
  //      POST /auth/login/verify-otp {challenge_id,code} → {bearer}. (mfa block below is UI-only)
  S1: {
    credentials: { email: 'ops@platform.com', password: '••••••••' },
    mfa: { type: 'totp', code: '123456' }, // GAP: real flow is SMS-OTP, not TOTP
    login_flow: {
      password_endpoint: 'POST /api/v1/auth/login/password',
      verify_endpoint: 'POST /api/v1/auth/login/verify-otp',
      returns: { challenge_id: 'uuid', bearer: 'session-uuid' },
    },
    personas: [
      { id: 'founder',     label: 'Founder / CEO',  roles: ['super_admin', 'compliance_reviewer'] },
      { id: 'ops_lead',    label: 'Ops Lead',        roles: ['ops_executive', 'treasury_and_settlement'] },
      { id: 'credit_lead', label: 'Credit Lead',     roles: ['credit_reviewer'] },
      { id: 'auditor',     label: 'Auditor',         roles: ['auditor'] },
    ],
  },

  // ── S2 — Admin Dashboard ──────────────────────────────────────
  // GAP G1: no list/dashboard/metrics endpoint exists. All queues + stats are UI-composed.
  S2: {
    queues: {
      ops_executive: [
        { id: 'q1', type: 'supplier_onboarding', label: 'Alpha Components — KYC pending',        status: 'pending',     age_days: 2 },
        { id: 'q2', type: 'invoice_check',        label: 'INV-2026-0042 — checks in progress',   status: 'in_progress', age_days: 0 },
      ],
      credit_reviewer: [
        { id: 'q3', type: 'buyer_credit',    label: 'Reliance Industries — credit review',       status: 'pending', age_days: 3 },
        { id: 'q4', type: 'supplier_credit', label: 'Beta Metals — exposure cap review',         status: 'pending', age_days: 1 },
      ],
      compliance_reviewer: [
        { id: 'q5', type: 'kyc_approval',    label: 'Investor Rahul Mehta — KYC submitted',     status: 'pending', age_days: 1 },
        { id: 'q6', type: 'invite_issuance', label: '2 pending invite requests',                 status: 'pending', age_days: 0 },
      ],
      treasury_and_settlement: [
        { id: 'q7', type: 'listing_golive', label: 'LST-001 — ready for go-live approval',       status: 'ready',   age_days: 0 },
        { id: 'q8', type: 'disbursement',   label: 'LST-002 — disbursement pending',             status: 'pending', age_days: 1 },
      ],
      super_admin: [
        { id: 'q9', type: 'user_management', label: '1 new admin user invite pending',           status: 'pending', age_days: 0 },
      ],
    },
    stats: {
      active_listings:       3,
      total_deployed_paise:  25000000,
      investors_active:      8,
      suppliers_active:      4,
      pending_disbursements: 1,
    },
  },

  // ── S3 — Supplier Onboarding ──────────────────────────────────
  // API: commands POST /suppliers/create, /{id}/submit-kyc, /record-credit-review, /activate, …
  //      read GET /suppliers/{id} → { supplier_id, status, aggregate_version } ONLY.
  // GAP G2: supplier list + display fields (legal_name/pan/gstin/consent/timestamps) are UI-composed.
  // status ∈ sup_account_status: created|identity_verified|kyc_submitted|kyc_approved|credit_reviewed|maa_signed|active
  S3: {
    suppliers: [
      {
        supplier_id: 'sup-001',
        legal_name: 'Alpha Components Pvt Ltd',
        constitution_type: 'private_limited',
        pan: 'AABCA1234Z',
        gstin: '27AABCA1234Z1Z5',
        cin: 'U74999MH2015PTC123456',
        status: 'kyc_submitted',
        kyc_approved_by: null,
        kyc_approved_at: null,
        credit_exposure_cap_paise: null,
        credit_risk_rating: null,
        maa_agreement_id: null,
        activated_at: null,
        agency_consent: { consent_id: 'con-001', scope: ['invoice_submission', 'kyc_upload', 'financial_profile'], granted_at: '2026-05-01T10:00:00Z', is_active: true },
      },
      {
        supplier_id: 'sup-002',
        legal_name: 'Beta Metals Pvt Ltd',
        constitution_type: 'private_limited',
        pan: 'AABCB5678Z',
        gstin: '27AABCB5678Z1Z2',
        cin: 'U27100MH2010PTC654321',
        status: 'active',
        kyc_approved_by: 'admin-001',
        kyc_approved_at: '2026-04-15T14:00:00Z',
        credit_exposure_cap_paise: 20000000,
        credit_risk_rating: 'A',
        maa_agreement_id: 'maa-001',
        activated_at: '2026-04-20T09:00:00Z',
        agency_consent: { consent_id: 'con-002', scope: ['invoice_submission', 'kyc_upload', 'financial_profile'], granted_at: '2026-04-01T10:00:00Z', is_active: true },
      },
    ],
    acting_as: null,
  },

  // ── S4 — Buyer Management ─────────────────────────────────────
  // API: POST /buyers/nominate, /{id}/record-identity-verified, /record-credit-assessment {credit_limit_paise},
  //      /start-engagement, /activate; credit via POST /credit/buyers/{id}/profile + /credit/pricing-bands.
  //      read GET /buyers/{id} → { buyer_id, status, aggregate_version }.
  // GAP G3: buyer list + display fields + pricing band list are UI-composed.
  // status ∈ buyer_account_status: nominated|identity_verified|credit_assessed|engagement_started|active|suspended
  S4: {
    buyers: [
      {
        buyer_id: 'buy-001',
        legal_name: 'Reliance Industries Ltd',
        mca_cin: 'L17110MH1973PLC019786',
        gstin: '27AAACR5055K1ZT',
        sector: 'Energy',
        relationship_tier: 'acknowledged_buyer',
        acknowledgment_mode: 'per_invoice',
        status: 'active',
        credit_limit_paise: 100000000,
        pricing_band_id: 'band-001',
        rating: 'AA+',
        rating_source: 'CRISIL',
        tenor_cap_days: 90,
        last_review_at: '2026-03-01T00:00:00Z',
      },
      {
        buyer_id: 'buy-002',
        legal_name: 'Tata Steel Ltd',
        mca_cin: 'L27100MH1907PLC000260',
        gstin: '27AAACT2727Q1ZX',
        sector: 'Manufacturing',
        relationship_tier: 'acknowledged_buyer',
        acknowledgment_mode: 'per_invoice',
        status: 'identity_verified', // was 'under_credit_review' (not a real status); awaiting credit assessment
        credit_limit_paise: null,
        pricing_band_id: null,
        rating: 'AA',
        rating_source: 'ICRA',
        tenor_cap_days: null,
        last_review_at: null,
      },
    ],
    // tenor_bucket ∈ risk_tenor_bucket: lte_30d|31_60d|61_90d|91_180d. API pricing bands carry a rate RANGE
    // (rate_range_min_bps/rate_range_max_bps) + fee_bps, not a single rate_bps — kept single here for display.
    pricing_bands: [
      { band_id: 'band-001', buyer_id: 'buy-001', tenor_bucket: '61_90d', rate_bps: 1200, fee_bps: 50 },
      { band_id: 'band-002', buyer_id: 'buy-001', tenor_bucket: '31_60d', rate_bps: 1050, fee_bps: 50 },
    ],
  },

  // ── S5 — Invoice Checks + Listing Approval ───────────────────
  // API: listing lifecycle — POST /listings, /{id}/start-ops-checks, /record-ops-check {check_name,outcome?},
  //      /complete-ops-checks, /snapshot-and-ready {rate_bps}, /approve-go-live (treasury, checker≠maker).
  //      read GET /listings/{id} → { listing_id, status, funding_target, va_id, aggregate_version }.
  // check_outcomes keys below use the canonical check_name wire values (irn_validity, buyer_supplier_relationship,
  // supplier_exposure_cap, buyer_limit_headroom, document_completeness). buyer_ack is a SEPARATE command
  // (POST /{id}/record-buyer-ack), grouped here for the UI only.
  // GAP G4: invoice list, supplier/buyer names, and per-check outcome detail are UI-composed (no read model).
  // invoice status ∈ deal_invoice_status: submitted|ops_checks_in_progress|ops_checks_passed|ops_checks_failed|listed
  S5: {
    invoices: [
      {
        invoice_id: 'inv-001',
        invoice_number: 'INV-2026-0042',
        supplier_name: 'Alpha Components Pvt Ltd',
        buyer_name: 'Reliance Industries Ltd',
        face_value: 5125000,
        tenor_days: 90,
        invoice_date: '2026-05-01',
        due_date: '2026-07-30',
        irn: 'IRN123456789012345678901234567890123456789012345678',
        status: 'ops_checks_in_progress',
        check_outcomes: {
          irn_validity:                { outcome: 'pass',    detail: 'Active on GST portal',          checked_at: '2026-05-02T09:00:00Z' },
          eway_bill_match:             { outcome: 'pass',    detail: 'E-way bill matches invoice',    checked_at: '2026-05-02T09:02:00Z' },
          buyer_supplier_relationship: { outcome: 'pass',    detail: 'Relationship validated',        checked_at: '2026-05-02T09:04:00Z' },
          duplicate_check:             { outcome: 'pass',    detail: 'No duplicate found',            checked_at: '2026-05-02T09:05:00Z' },
          supplier_exposure_cap:       { outcome: 'pass',    detail: 'Within supplier cap',           checked_at: '2026-05-02T09:06:00Z' },
          buyer_limit_headroom:        { outcome: 'pass',    detail: 'Headroom ₹9,48,750 remaining', checked_at: '2026-05-02T09:07:00Z' },
          document_completeness:       { outcome: 'pending', detail: 'Document upload awaited',      checked_at: null },
          buyer_ack:                   { outcome: 'pending', detail: 'Acknowledgment request sent',  checked_at: null },
        },
      },
      {
        invoice_id: 'inv-002',
        invoice_number: 'INV-2026-0039',
        supplier_name: 'Beta Metals Pvt Ltd',
        buyer_name: 'Tata Steel Ltd',
        face_value: 10200000,
        tenor_days: 60,
        invoice_date: '2026-04-25',
        due_date: '2026-06-24',
        irn: 'IRN987654321098765432109876543210987654321098765432',
        status: 'ops_checks_passed',
        check_outcomes: {
          irn_validity:                { outcome: 'pass', detail: 'Active',             checked_at: '2026-04-26T09:00:00Z' },
          eway_bill_match:             { outcome: 'pass', detail: 'Match',              checked_at: '2026-04-26T09:01:00Z' },
          buyer_supplier_relationship: { outcome: 'pass', detail: 'OK',                 checked_at: '2026-04-26T09:02:00Z' },
          duplicate_check:             { outcome: 'pass', detail: 'Clean',              checked_at: '2026-04-26T09:03:00Z' },
          supplier_exposure_cap:       { outcome: 'pass', detail: 'Within',             checked_at: '2026-04-26T09:04:00Z' },
          buyer_limit_headroom:        { outcome: 'pass', detail: 'OK',                 checked_at: '2026-04-26T09:05:00Z' },
          document_completeness:       { outcome: 'pass', detail: 'All docs present',   checked_at: '2026-04-26T09:06:00Z' },
          buyer_ack:                   { outcome: 'pass', detail: 'Acknowledged by portal', checked_at: '2026-04-26T09:10:00Z' },
        },
      },
    ],
    listings_for_approval: [
      {
        listing_id: 'lst-005',
        invoice_number: 'INV-2026-0039',
        supplier_name: 'Beta Metals Pvt Ltd',
        buyer_name: 'Tata Steel Ltd',
        funding_target: 9996000,
        rate_bps: 1050,
        tenor_days: 60,
        maker_id: 'admin-ops',
        maker_name: 'Ops Lead',
        status: 'ready_for_review',
      },
    ],
  },

  // ── S6 — Disbursement Queue ───────────────────────────────────
  // API: POST /listings/{id}/disbursement/draft (maker) → /disbursement/approve (checker≠maker) → disbursed.
  //      read GET /listings/{id}/disbursement → { payout_instruction_id, status, gross_amount, listing_status }.
  // status ∈ cash_payout_status: drafted|approved|sent|executed|partial|failed|completed
  // GAP G5: no disbursement queue list; net_amount / maker-checker names / UTR are UI-composed.
  S6: {
    disbursements: [
      {
        disbursement_id: 'disb-001',
        listing_id: 'lst-002',
        supplier_name: 'Beta Metals Pvt Ltd',
        buyer_name: 'Tata Steel Ltd',
        net_amount_paise: 9996000, // GAP G5: UI-composed (read returns gross_amount only)
        status: 'drafted', // was 'pending_approval'
        all_signed: true,
        funding_completed_at: '2026-05-20T15:00:00Z',
        due_disbursement_date: '2026-05-21',
        maker_id: 'admin-ops',
        maker_name: 'Ops Lead',
        checker_id: null,
        checker_name: null,
        utr: null,
      },
      {
        disbursement_id: 'disb-002',
        listing_id: 'lst-003',
        supplier_name: 'Gamma Tech Services',
        buyer_name: 'Infosys Ltd',
        net_amount_paise: 7840000,
        status: 'executed',
        all_signed: true,
        funding_completed_at: '2026-05-10T12:00:00Z',
        due_disbursement_date: '2026-05-11',
        maker_id: 'admin-ops',
        maker_name: 'Ops Lead',
        checker_id: 'admin-treasury',
        checker_name: 'Ops Lead (Treasury role)',
        executed_at: '2026-05-11T10:00:00Z',
        utr: 'UTR20260511000123',
      },
    ],
  },

  // ── S7 — Distribution + Reconciliation ───────────────────────
  // API: POST /listings/{id}/record-maturity {amount_paise,utr} → /distribution/draft → /distribution/approve
  //      (closes deal → distributed). read GET /listings/{id}/distribution →
  //      { payout_instruction_id, status, gross_amount, net_amount, total_tds_amount, listing_status, terminal_outcome }.
  // status ∈ cash_payout_status (drafted|approved|…). GAP G6: per-investor breakdown + reconciliation have no endpoint.
  S7: {
    distributions: [
      {
        distribution_id: 'dist-001',
        listing_id: 'lst-004',
        buyer_name: 'HCL Technologies Ltd',
        maturity_date: '2026-05-15',
        buyer_payment_ref: 'NEFT20260515ABC',
        buyer_payment_amount_paise: 10400000,
        status: 'drafted', // was 'distribution_pending'
        investors: [
          { investor_name: 'Rahul Mehta', amount_paise: 2000000, gross_paise: 2058333, tds_paise: 8333, fee_paise: 1000, net_paise: 2049000, utr: null },
          { investor_name: 'Priya Shah',  amount_paise: 3000000, gross_paise: 3087500, tds_paise: 12500, fee_paise: 1500, net_paise: 3073500, utr: null },
          { investor_name: 'Amit Joshi',  amount_paise: 5000000, gross_paise: 5145833, tds_paise: 20833, fee_paise: 2500, net_paise: 5122500, utr: null },
        ],
      },
    ],
    // GAP G6: reconciliation is entirely UI-composed — the backend exposes no reconciliation endpoint.
    reconciliation: [
      {
        rec_id: 'rec-001',
        listing_id: 'lst-004',
        buyer_name: 'HCL Technologies Ltd',
        expected_paise: 10400000,
        actual_paise: 10400000,
        status: 'matched',
        reconciled_at: '2026-05-15T14:30:00Z',
        txn_ref: 'NEFT20260515ABC',
      },
      {
        rec_id: 'rec-002',
        listing_id: 'lst-006',
        buyer_name: 'Wipro Ltd',
        expected_paise: 5000000,
        actual_paise: 4800000,
        status: 'partial',
        reconciled_at: '2026-05-18T11:00:00Z',
        txn_ref: 'NEFT20260518XYZ',
      },
    ],
  },

  // ── S8 — Investor Invite Issuance ─────────────────────────────
  // API: POST /investor-invites/issue {email,phone} → command envelope. status ∈ inv_invite_status: pending|consumed|expired.
  // GAP G7: no invite LIST endpoint; issued_by/justification are UI-only (issue takes only {email,phone}).
  S8: {
    invites: [
      { invite_id: 'inv-i-001', email_display: 'r.mehta@example.com', phone_display: '+91 98765 43210', issued_by: 'Founder / CEO', issued_at: '2026-05-01T10:00:00Z', expiry_at: '2026-05-15T10:00:00Z', status: 'consumed', consumed_at: '2026-05-03T09:00:00Z', justification: 'Personal network — known HNI' },
      { invite_id: 'inv-i-002', email_display: 'p.shah@example.com',  phone_display: '+91 91234 56789', issued_by: 'Founder / CEO', issued_at: '2026-05-18T14:00:00Z', expiry_at: '2026-06-01T14:00:00Z', status: 'pending',  consumed_at: null,                justification: 'Referral from Rahul Mehta' },
      { invite_id: 'inv-i-003', email_display: 'a.kumar@example.com', phone_display: '+91 99887 76655', issued_by: 'Founder / CEO', issued_at: '2026-04-10T09:00:00Z', expiry_at: '2026-04-24T09:00:00Z', status: 'expired',  consumed_at: null,                justification: 'Angel network contact' },
    ],
  },

  // ── S9 — Audit Log ────────────────────────────────────────────
  // GAP G8: no audit-query endpoint exists. Entire screen is UI-composed. (Commands ARE audit-logged
  // server-side, but there is no read API to list them yet.)
  S9: {
    events: [
      { event_id: 'evt-001', event_type: 'Listing.GoneLive',          actor: 'Ops Lead (Treasury role)', target: 'LST-002',   recorded_at: '2026-05-10T09:00:00Z', sensitivity: 'standard' },
      { event_id: 'evt-002', event_type: 'InvestorAccount.Activated', actor: 'System',                   target: 'INV-001',   recorded_at: '2026-05-03T10:00:00Z', sensitivity: 'sensitive' },
      { event_id: 'evt-003', event_type: 'Subscription.Committed',    actor: 'Investor: Rahul Mehta',    target: 'SUB-001',   recorded_at: '2026-05-11T11:00:00Z', sensitivity: 'standard' },
      { event_id: 'evt-004', event_type: 'AgencyAction.Recorded',     actor: 'Ops Lead',                 target: 'SUP-001',   recorded_at: '2026-05-05T14:00:00Z', sensitivity: 'standard' },
      { event_id: 'evt-005', event_type: 'Invite.Issued',             actor: 'Founder / CEO',            target: 'INV-I-002', recorded_at: '2026-05-18T14:00:00Z', sensitivity: 'sensitive' },
      { event_id: 'evt-006', event_type: 'KycFile.Approved',          actor: 'Founder / CEO',            target: 'INV-001',   recorded_at: '2026-05-02T16:00:00Z', sensitivity: 'sensitive' },
      { event_id: 'evt-007', event_type: 'Listing.Disbursed',         actor: 'System (BC4)',             target: 'LST-003',   recorded_at: '2026-05-11T10:30:00Z', sensitivity: 'standard' },
      { event_id: 'evt-008', event_type: 'BuyerAccount.Nominated',    actor: 'Credit Lead',              target: 'BUY-002',   recorded_at: '2026-05-15T09:00:00Z', sensitivity: 'standard' },
    ],
    scope: {
      scope_id: 'scope-001',
      date_range: { from: '2026-04-01', to: '2026-06-30' },
      entity_types: ['Listing', 'Invoice', 'Subscription', 'InvestorAccount', 'SupplierAccount'],
      sensitivity_level: 'sensitive',
    },
  },

  // ── S10–S15 (investor / supplier / buyer — from Step 2) ───────
  // S10 — Investor onboarding. API: POST /investors/sign-up {invite_id,email,phone,sub_type},
  // /{id}/record-identity-verified {pan,aadhaar_last4}, /submit-kyc, /assess-suitability {mismatch?},
  // /complete-financial-profile {bank_account_last4}, /record-kyc-approved, /record-mia-signed, /activate.
  // read GET /investors/{id} → { investor_id, status, aggregate_version }.
  // sub_type ∈ inv_sub_type: resident_individual|huf|nri|institutional (only first two active Phase 1).
  // status ∈ inv_account_status: signed_up|identity_verified|kyc_submitted|suitability_assessed|
  //          financial_profile_completed|kyc_approved|mia_signed|active. fatca ∈ us_person|non_us_person|pending.
  S10: {
    invite: { invite_id: 'inv-001', expiry_at: '2026-06-01T00:00:00Z', status: 'pending' },
    investor: { investor_id: 'inv-acct-001', sub_type: 'resident_individual', status: 'kyc_submitted', pan: 'ABCDE1234F', aadhaar_last4: '7890', bank_account_last4: '4321', fatca_status: 'non_us_person', kyc_approved_by: null, kyc_approved_at: null, mia_signed_at: null, activated_at: null },
    suitability: { assessment_id: 'suit-001', mismatch: false, override_text_hash: null },
  },

  // S11 — Marketplace. GAP G9: no list-of-live-listings endpoint (only GET /listings/{id}).
  // Subscribe IS backed: POST /listings/{id}/subscriptions/commit {investor_id, amount_paise}.
  S11: {
    listings: [
      { listing_id: 'lst-001', buyer_name: 'Reliance Industries Ltd', buyer_sector: 'Energy',        supplier_name: 'Alpha Components Pvt Ltd', funding_target: 5000000,  committed_total: 3000000,  funding_window_close_at: '2026-05-28T18:00:00Z', rate_bps: 1200, tenor_days: 90, due_date: '2026-08-20', status: 'live',         investor_subscribed: false },
      { listing_id: 'lst-002', buyer_name: 'Tata Steel Ltd',          buyer_sector: 'Manufacturing', supplier_name: 'Beta Metals Pvt Ltd',      funding_target: 10000000, committed_total: 10000000, funding_window_close_at: '2026-05-25T18:00:00Z', rate_bps: 1050, tenor_days: 60, due_date: '2026-07-25', status: 'fully_funded', investor_subscribed: false },
      { listing_id: 'lst-003', buyer_name: 'Infosys Ltd',             buyer_sector: 'Technology',    supplier_name: 'Gamma Tech Services',      funding_target: 8000000,  committed_total: 1600000,  funding_window_close_at: '2026-05-30T18:00:00Z', rate_bps: 1100, tenor_days: 75, due_date: '2026-08-12', status: 'live',         investor_subscribed: true },
    ],
  },

  // S12 — Listing detail + subscribe. read GET /listings/{id} returns ONLY
  // { listing_id, status, funding_target, va_id, aggregate_version }.
  // GAP G10: pricing_snapshot, committed_total, VA number/IFSC, invoice detail, buyer/supplier = UI-composed.
  // Invoice PDF IS backed: GET /listings/{id}/invoice-documents + …/{documentId}/content.
  S12: {
    listing: { listing_id: 'lst-001', status: 'live', funding_target: 5000000, committed_total: 3000000, funding_window_close_at: '2026-05-28T18:00:00Z', pricing_snapshot: { rate_bps: 1200, fee_bps: 50, snapshot_at: '2026-05-01T10:00:00Z' }, va_id: 'va-001', virtual_account_number: '9234567890123456', virtual_account_ifsc: 'RATN0VAAPIS' },
    invoice: { invoice_number: 'INV-2026-0042', face_value: 5125000, tenor_days: 90, due_date: '2026-08-20', invoice_date: '2026-05-01', irn: 'IRN123456789012345678901234567890123456789012345678', check_outcomes: { irn_validity: { outcome: 'pass', detail: 'IRN active on GST portal', checked_at: '2026-05-02T09:00:00Z' }, buyer_ack: { outcome: 'pass', detail: 'Acknowledged by buyer signatory', checked_at: '2026-05-02T10:00:00Z' }, duplicate_check: { outcome: 'pass', detail: 'No duplicate found', checked_at: '2026-05-02T09:05:00Z' } } },
    buyer: { name: 'Reliance Industries Ltd', sector: 'Energy', rating: 'AA+', rating_source: 'CRISIL' },
    supplier: { name: 'Alpha Components Pvt Ltd', constitution_type: 'private_limited' },
    subscription: null,
  },

  // S13 — Portfolio + statements. TDS ledger + statements ARE backed:
  //   GET /investors/{id}/tax/deductions?fy= → [{listing_id,fy_code,gross_paise,tds_amount_paise,fee_paise,net_paise,challan_ref}]
  //   GET /investors/{id}/tax/statements → [{period,kind,generated_at,doc_hash}] (kind ∈ monthly_portfolio|form_16a)
  //   Form 16A: POST/GET /investors/{id}/tax/form-16a/{fyCode}.
  // GAP G11: portfolio (subscriptions list + summary) has no per-investor list endpoint — UI-composed.
  // subscription status ∈ sub_subscription_status: committed|funds_pending|funds_received|confirmed|
  //   assignment_executed|distribution_received|closed|cancelled_by_investor|refunded|loss_realised.
  S13: {
    investor: { investor_id: 'inv-acct-001', sub_type: 'resident_individual', pan: 'ABCDE1234F', aadhaar_last4: '7890', bank_account_last4: '4321', activated_at: '2026-04-01T00:00:00Z', kyc_refresh_due_at: '2027-04-01T00:00:00Z', status: 'active' },
    summary: { total_deployed_paise: 3000000, total_returned_paise: 1050000, active_positions: 2, matured_positions: 1 },
    subscriptions: [
      { subscription_id: 'sub-001', listing_id: 'lst-003', buyer_name: 'Infosys Ltd', supplier_name: 'Gamma Tech Services', amount: 1000000, status: 'confirmed', due_date: '2026-08-12', assignment_doc_hash: null, distribution_outcome: null, concentration_warnings_at_commit: [] },
      { subscription_id: 'sub-002', listing_id: 'lst-004', buyer_name: 'HCL Technologies Ltd', supplier_name: 'Delta IT Supplies', amount: 2000000, status: 'closed', due_date: '2026-04-10', assignment_doc_hash: 'abc123hash', distribution_outcome: { gross: 2058333, tds: 8333, fee: 1000, net: 2049000 }, concentration_warnings_at_commit: [] },
    ],
    tds: [
      { tds_deduction_id: 'tds-001', listing_id: 'lst-004', buyer_name: 'HCL Technologies Ltd', fy_code: 'FY2025-26', gross_paise: 2058333, tds_amount_paise: 8333, fee_paise: 1000, net_paise: 2049000, challan_ref: 'CHL20260410001' },
    ],
    statements: [
      { period: '2026-04', kind: 'monthly_portfolio', doc_hash: 'stmthash001', generated_at: '2026-05-01T06:00:00Z' },
    ],
  },

  // S14 — Supplier portal. GAP G12: per-supplier invoice/listing tracker has no read endpoint.
  // Supplier self-service create is NOT built backend-side (listings are ops-created via POST /listings +
  // two-phase POST /documents upload). GET /suppliers/{id} returns status+version only.
  S14: {
    supplier: {
      supplier_id: 'sup-001',
      legal_name: 'Alpha Components Pvt Ltd',
      constitution_type: 'private_limited',
      pan: 'AABCA1234Z',
      gstin: '27AABCA1234Z1Z5',
      status: 'active',
      activated_at: '2026-04-20T09:00:00Z',
      agency_consent: {
        consent_id: 'con-001',
        scope: ['invoice_submission', 'kyc_upload', 'financial_profile'],
        granted_at: '2026-05-01T10:00:00Z',
        is_active: true,
      },
    },
    invoices: [
      {
        invoice_id: 'inv-001',
        invoice_number: 'INV-2026-0042',
        buyer_name: 'Reliance Industries Ltd',
        face_value: 5125000,
        invoice_date: '2026-05-01',
        due_date: '2026-07-30',
        tenor_days: 90,
        irn: 'IRN123456789012345678901234567890123456789012345678',
        status: 'ops_checks_in_progress',
        listing: {
          listing_id: 'lst-001',
          status: 'live',
          funding_target: 5000000,
          committed_total: 3000000,
          investor_count: 3,
          funding_window_close_at: '2026-05-28T18:00:00Z',
          rate_bps: 1200,
          disbursed_at: null,
          disbursement_utr: null,
        },
      },
      {
        invoice_id: 'inv-002',
        invoice_number: 'INV-2026-0039',
        buyer_name: 'Tata Steel Ltd',
        face_value: 10200000,
        invoice_date: '2026-04-25',
        due_date: '2026-06-24',
        tenor_days: 60,
        irn: 'IRN987654321098765432109876543210987654321098765432',
        status: 'disbursed',
        listing: {
          listing_id: 'lst-002',
          status: 'disbursed',
          funding_target: 9996000,
          committed_total: 9996000,
          investor_count: 5,
          funding_window_close_at: '2026-05-15T18:00:00Z',
          rate_bps: 1050,
          disbursed_at: '2026-05-16T10:00:00Z',
          disbursement_utr: 'UTR20260516000456',
        },
      },
      {
        invoice_id: 'inv-003',
        invoice_number: 'INV-2026-0051',
        buyer_name: 'Reliance Industries Ltd',
        face_value: 3000000,
        invoice_date: '2026-05-18',
        due_date: '2026-08-16',
        tenor_days: 90,
        irn: null,
        status: 'submitted',
        listing: null,
      },
    ],
    upload_draft: {
      irn: '', invoice_number: '', buyer_id: '', face_value: '', invoice_date: '', tenor_days: '', doc_hash: null,
    },
    available_buyers: [
      { buyer_id: 'buy-001', legal_name: 'Reliance Industries Ltd' },
      { buyer_id: 'buy-002', legal_name: 'Tata Steel Ltd' },
    ],
  },

  // S15 — Buyer portal. Ack user logs in OTP-only (verify-otp flow). GAP G13: buyer-facing reads
  // (invoice list, payment instruction, NOA) and buyer SELF-ack have no endpoint — buyer ack is currently
  // recorded admin-side via POST /listings/{id}/record-buyer-ack. All buyer-portal data below is UI-composed.
  S15: {
    login: {
      email: 'procurement@reliance.com',
      otp_sent: false,
      otp_verified: false,
    },
    buyer: {
      buyer_id: 'buy-001',
      legal_name: 'Reliance Industries Ltd',
      ack_user: {
        ack_user_id: 'ack-001',
        display_name: 'Rajan Nair',
        email: 'procurement@reliance.com',
        phone: '+91 98765 00001',
      },
    },
    payment_instruction: {
      instruction_id: 'pi-001',
      escrow_bank: 'RBL Bank Ltd',
      account_name: 'Platform Escrow — Reliance Industries',
      account_number: '1234567890123456',
      ifsc: 'RATN0VAAPIS',
      effective_from: '2026-04-01',
      note: 'Pay to this account for each invoice at due date. Use invoice number as payment reference.',
    },
    invoices: [
      {
        invoice_id: 'inv-001',
        invoice_number: 'INV-2026-0042',
        supplier_name: 'Alpha Components Pvt Ltd',
        face_value: 5125000,
        invoice_date: '2026-05-01',
        due_date: '2026-07-30',
        tenor_days: 90,
        ack_status: 'pending',
        ack_requested_at: '2026-05-03T09:00:00Z',
        ack_sla_deadline: '2026-05-06T09:00:00Z',
        acknowledged_at: null,
        noa_available: false,
      },
      {
        invoice_id: 'inv-004',
        invoice_number: 'INV-2026-0038',
        supplier_name: 'Alpha Components Pvt Ltd',
        face_value: 7500000,
        invoice_date: '2026-04-20',
        due_date: '2026-07-19',
        tenor_days: 90,
        ack_status: 'acknowledged',
        ack_requested_at: '2026-04-22T09:00:00Z',
        ack_sla_deadline: '2026-04-25T09:00:00Z',
        acknowledged_at: '2026-04-23T14:30:00Z',
        noa_available: true,
      },
      {
        invoice_id: 'inv-005',
        invoice_number: 'INV-2026-0035',
        supplier_name: 'Alpha Components Pvt Ltd',
        face_value: 4200000,
        invoice_date: '2026-04-10',
        due_date: '2026-07-09',
        tenor_days: 90,
        ack_status: 'pending',
        ack_requested_at: '2026-04-12T09:00:00Z',
        ack_sla_deadline: '2026-04-15T09:00:00Z',
        acknowledged_at: null,
        noa_available: false,
      },
    ],
  },
}

export default mockData
