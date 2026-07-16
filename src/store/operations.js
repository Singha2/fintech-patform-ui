// Canonical ops-check set (wire `check_name`s for POST /listings/{id}/record-ops-check; buyer_ack is a separate
// command grouped here for the UI). A freshly-submitted invoice starts with every check pending; the ops screen
// (S5) records each outcome. Kept here so both the operations and the ops screen share one source of truth.
export const DEFAULT_CHECKS = {
  irn_validity:                { outcome: 'pending', detail: 'Awaiting GST portal verification', checked_at: null },
  eway_bill_match:             { outcome: 'pending', detail: 'Awaiting e-way bill match',        checked_at: null },
  buyer_supplier_relationship: { outcome: 'pending', detail: 'Awaiting relationship validation', checked_at: null },
  duplicate_check:             { outcome: 'pending', detail: 'Awaiting duplicate scan',          checked_at: null },
  supplier_exposure_cap:       { outcome: 'pending', detail: 'Awaiting exposure cap check',      checked_at: null },
  buyer_limit_headroom:        { outcome: 'pending', detail: 'Awaiting headroom check',          checked_at: null },
  document_completeness:       { outcome: 'pending', detail: 'Awaiting document review',         checked_at: null },
  buyer_ack:                   { outcome: 'pending', detail: 'Acknowledgment request pending',   checked_at: null },
}
const cloneDefaultChecks = () => JSON.parse(JSON.stringify(DEFAULT_CHECKS))

// Per-investor payout math (DL-045/G4: gross − tds − fee = net). Backend computes these — the mock fakes a
// plausible split so the S7 distribution table + S13 portfolio have numbers to show.
function computePayout(amountPaise, rateBps, tenorDays, feeBps = 50) {
  const gross = Math.round(amountPaise * (1 + (rateBps / 10000) * (tenorDays / 365)))
  const tds = Math.round((gross - amountPaise) * 0.10)
  const fee = Math.round(amountPaise * (feeBps / 10000))
  return { gross_paise: gross, tds_paise: tds, fee_paise: fee, net_paise: gross - tds - fee }
}

// Draft a distribution for a listing from its subscriptions (used when a listing reaches distribution without a
// seeded distribution row). Mirrors POST /listings/{id}/distribution/draft.
function buildDistribution(st, listingId) {
  const listing = st.listings[listingId] ?? {}
  const rateBps = listing.pricing_snapshot?.rate_bps ?? listing.rate_bps ?? 1200
  const feeBps = listing.pricing_snapshot?.fee_bps ?? 50
  const tenor = listing.tenor_days ?? 90
  const subs = Object.values(st.subscriptions).filter(s => s.listing_id === listingId)
  const investors = subs.map(s => {
    const amount = s.amount ?? 0
    const p = computePayout(amount, rateBps, tenor, feeBps)
    return { investor_name: s.investor_name ?? s.investor_id ?? 'Investor', investor_id: s.investor_id ?? null, subscription_id: s.subscription_id, amount_paise: amount, ...p, utr: null }
  })
  return {
    distribution_id: `dist-${listingId}`, listing_id: listingId,
    buyer_name: listing.buyer_name ?? '—', maturity_date: listing.due_date ?? null,
    buyer_payment_ref: null, buyer_payment_amount_paise: investors.reduce((a, i) => a + i.gross_paise, 0),
    status: 'drafted', matured: false, investors,
  }
}

// Command-shaped operations — mirror the backend commands so the live swap is 1:1 (mock now → POST commands
// at integration). Each operation mutates the store via the generic UPSERT/PATCH primitives and appends an
// audit event (which makes S9's log a real projection of the session). `getState` gives current state for
// operations that must merge into an existing entity.
export function makeOperations(dispatch, getState) {
  const upsert = (collection, id, entity) => dispatch({ type: 'UPSERT', collection, id, entity })
  const patch  = (collection, id, partial) => dispatch({ type: 'PATCH', collection, id, patch: partial })
  const audit  = (event_type, target) => dispatch({
    type: 'APPEND_AUDIT',
    event: { event_id: `evt-${Date.now()}`, event_type, target, actor: 'mock-user', recorded_at: new Date().toISOString(), sensitivity: 'standard' },
  })

  return {
    // ── Suppliers (live: POST /suppliers/create + the transition chain) ──
    createSupplier: (input) => {
      const id = input.supplier_id ?? `sup-${Date.now()}`
      upsert('suppliers', id, { supplier_id: id, status: 'created', ...input })
      audit('SupplierAccount.Created', id)
      return id
    },
    advanceSupplier: (id, toStatus) => { patch('suppliers', id, { status: toStatus }); audit(`SupplierAccount.${toStatus}`, id) },

    // ── Buyers (live: POST /buyers/* + /credit/buyers/{id}/profile) ──
    createBuyer: (input) => {
      const id = input.buyer_id ?? `buy-${Date.now()}`
      upsert('buyers', id, { buyer_id: id, status: 'nominated', ...input })
      audit('BuyerAccount.Nominated', id)
      return id
    },
    advanceBuyer:  (id, toStatus) => { patch('buyers', id, { status: toStatus }); audit(`BuyerAccount.${toStatus}`, id) },
    setBuyerCredit: (id, paise) => { patch('buyers', id, { credit_limit_paise: paise }); audit('BuyerAccount.CreditAssessed', id) },
    attestKyb:     (id, document_id) => { patch('buyers', id, { kyb_verified: true, kyb_document_id: document_id ?? null }); audit('BuyerAccount.KybAttested', id) },

    // ── Investor invites + onboarding (live: /investor-invites/issue, /investors/*) ──
    issueInvite:   (input) => { const id = `inv-i-${Date.now()}`; upsert('invites', id, { invite_id: id, status: 'pending', ...input }); audit('Invite.Issued', id); return id },
    revokeInvite:  (id) => { patch('invites', id, { status: 'revoked' }); audit('Invite.Revoked', id) },
    signUpInvestor: (input) => { const id = input.investor_id ?? `inv-acct-${Date.now()}`; upsert('investors', id, { investor_id: id, status: 'signed_up', ...input }); audit('InvestorAccount.SignedUp', id); return id },
    advanceInvestor: (id, toStatus) => { patch('investors', id, { status: toStatus }); audit(`InvestorAccount.${toStatus}`, id) },

    // ── Invoices (live: POST /documents + POST /listings for ops-created invoices) ──
    submitInvoice: (input) => {
      const id = input.invoice_id ?? `inv-${Date.now()}`
      // Seed the ops-check grid (all pending) so the invoice can travel through S5 checks (G-D1).
      upsert('invoices', id, { invoice_id: id, status: 'submitted', listing: null, check_outcomes: cloneDefaultChecks(), ...input })
      audit('Invoice.Submitted', id)
      return id
    },
    acknowledgeInvoice: (invoiceId) => {
      // Buyer self-ack (mock stand-in for the WS-2 endpoint). Also stamps the invoice's buyer_ack ops-check so
      // the ops screen (S5) reflects the buyer's acknowledgment — closes the S15→S5 continuity gap (G-B3).
      const inv = getState().invoices[invoiceId]
      const check_outcomes = { ...(inv?.check_outcomes ?? {}), buyer_ack: { outcome: 'pass', detail: 'Acknowledged by buyer portal', checked_at: new Date().toISOString() } }
      patch('invoices', invoiceId, { ack_status: 'acknowledged', acknowledged_at: new Date().toISOString(), check_outcomes })
      audit('Invoice.Acknowledged', invoiceId)
    },

    // ── Listing lifecycle (live: POST /listings/{id}/record-ops-check, snapshot-and-ready, approve-go-live) ──
    // Record one ops-check outcome; recompute the invoice status from the whole grid (P3).
    recordOpsCheck: (invoiceId, checkName, outcome) => {
      const inv = getState().invoices[invoiceId]
      const check_outcomes = { ...(inv?.check_outcomes ?? cloneDefaultChecks()) }
      check_outcomes[checkName] = { ...(check_outcomes[checkName] ?? {}), outcome, checked_at: new Date().toISOString() }
      const allPassed = Object.values(check_outcomes).every(o => o.outcome === 'pass')
      const anyFailed = Object.values(check_outcomes).some(o => o.outcome === 'fail')
      const status = anyFailed ? 'ops_checks_failed' : allPassed ? 'ops_checks_passed' : 'ops_checks_in_progress'
      patch('invoices', invoiceId, { check_outcomes, status })
      audit('Listing.OpsCheckRecorded', invoiceId)
    },

    // Price a fully-checked invoice into a reviewable listing (live: POST /listings + snapshot-and-ready).
    // Builds a listing rich enough for the S5 approval list, the S11 marketplace card, and the S12 detail.
    createListing: (invoiceId, opts = {}) => {
      const st = getState()
      const inv = st.invoices[invoiceId]
      if (!inv) return null
      const existing = Object.values(st.listings).find(l => l.invoice_id === invoiceId)
      if (existing) return existing.listing_id
      const id = `lst-${Date.now()}`
      const rate_bps = opts.rate_bps ?? 1200
      const buyer = inv.buyer_id ? st.buyers[inv.buyer_id] : null
      const supplier = inv.supplier_id ? st.suppliers[inv.supplier_id] : null
      upsert('listings', id, {
        listing_id: id,
        invoice_id: invoiceId,
        invoice_number: inv.invoice_number,
        supplier_id: inv.supplier_id ?? null,
        supplier_name: inv.supplier_name ?? supplier?.legal_name ?? '—',
        buyer_id: inv.buyer_id ?? null,
        buyer_name: inv.buyer_name ?? buyer?.legal_name ?? '—',
        buyer_sector: buyer?.sector ?? opts.buyer_sector ?? '—',
        funding_target: opts.funding_target ?? Math.round((inv.face_value ?? 0) * 0.96), // backend computes — mock fakes
        committed_total: 0,
        rate_bps,
        tenor_days: inv.tenor_days ?? null,
        due_date: inv.due_date ?? null,
        funding_window_close_at: opts.funding_window_close_at ?? null,
        maker_id: 'admin-ops', maker_name: 'Ops Lead',
        status: 'ready_for_review',
        investor_subscribed: false,
        pricing_snapshot: { rate_bps, fee_bps: 50, snapshot_at: new Date().toISOString() },
        va_id: null, virtual_account_number: null, virtual_account_ifsc: null, // backend mints VA on go-live
      })
      patch('invoices', invoiceId, { status: 'listed', listing_id: id })
      audit('Listing.Created', id)
      return id
    },

    // Treasury go-live approval (live: POST /listings/{id}/approve-go-live, checker≠maker, MFA). Mints the VA.
    approveGoLive: (listingId) => {
      patch('listings', listingId, {
        status: 'live',
        va_id: `va-${listingId}`,                       // backend computes — mock fakes
        virtual_account_number: '9234567890123456',
        virtual_account_ifsc: 'RATN0VAAPIS',
      })
      audit('Listing.WentLive', listingId)
    },

    // ── Money flow (P4) ──────────────────────────────────────────────────────────────────────────────
    // Investor commits to a listing (live: POST /listings/{id}/subscriptions/commit). Grows committed_total,
    // flips the listing to fully_funded at target, and — the moment funding completes — drafts a disbursement so
    // it surfaces in the S6 queue. Closes G-E1 (commit → disbursement).
    commitSubscription: (listingId, { investor_id, investor_name, amount_paise }) => {
      const st = getState()
      const listing = st.listings[listingId]
      if (!listing) return null
      const id = `sub-${Date.now()}`
      upsert('subscriptions', id, {
        subscription_id: id, listing_id: listingId, investor_id, investor_name,
        buyer_name: listing.buyer_name, supplier_name: listing.supplier_name,
        amount: amount_paise, status: 'committed', due_date: listing.due_date ?? null,
        distribution_outcome: null, concentration_warnings_at_commit: [],
      })
      const committed_total = (listing.committed_total ?? 0) + amount_paise
      const funded = committed_total >= (listing.funding_target ?? Infinity)
      patch('listings', listingId, { committed_total, investor_subscribed: true, status: funded ? 'fully_funded' : listing.status })
      if (funded && !st.disbursements[listingId]) {
        upsert('disbursements', listingId, {
          disbursement_id: `disb-${listingId}`, listing_id: listingId,
          supplier_name: listing.supplier_name, buyer_name: listing.buyer_name,
          net_amount_paise: listing.funding_target, // backend computes — mock fakes
          status: 'drafted', all_signed: true,
          funding_completed_at: new Date().toISOString(),
          due_disbursement_date: listing.due_date ?? null,
          maker_id: 'admin-ops', maker_name: 'Ops Lead', checker_id: null, checker_name: null, utr: null,
        })
        audit('Listing.FullyFunded', listingId)
      }
      audit('Subscription.Committed', id)
      return id
    },

    // Treasury approves a disbursement (live: POST /listings/{id}/disbursement/approve, checker≠maker, MFA).
    // Disburses to the supplier, moves the listing to disbursed, advances its subscriptions, and drafts the
    // distribution so the listing appears in S7 ready for maturity + payout.
    approveDisbursement: (listingId) => {
      const st = getState()
      patch('disbursements', listingId, { status: 'executed', executed_at: new Date().toISOString(), utr: `UTR${Date.now()}`, checker_name: 'Treasury Lead' })
      patch('listings', listingId, { status: 'disbursed' })
      Object.values(st.subscriptions).filter(s => s.listing_id === listingId)
        .forEach(s => patch('subscriptions', s.subscription_id, { status: 'assignment_executed' }))
      if (!st.distributions[listingId]) {
        const draft = buildDistribution(getState(), listingId)
        if (draft.investors.length > 0) upsert('distributions', listingId, draft)
      }
      audit('Listing.Disbursed', listingId)
    },

    // Treasury records the buyer's maturity repayment (live: POST /listings/{id}/record-maturity). Gates the
    // distribution execution (C23). Drafts the distribution if one doesn't exist yet.
    recordMaturity: (listingId, { amount_paise, ref } = {}) => {
      const st = getState()
      if (!st.distributions[listingId]) {
        const draft = buildDistribution(st, listingId)
        upsert('distributions', listingId, draft)
      }
      const dist = getState().distributions[listingId]
      patch('distributions', listingId, {
        matured: true,
        buyer_payment_amount_paise: amount_paise ?? dist.buyer_payment_amount_paise,
        buyer_payment_ref: ref ?? dist.buyer_payment_ref ?? `NEFT${Date.now()}`,
        maturity_date: dist.maturity_date ?? new Date().toISOString().slice(0, 10),
      })
      audit('Listing.MaturityRecorded', listingId)
    },

    // Treasury executes the distribution (live: POST /listings/{id}/distribution/approve → deal closed). Stamps a
    // UTR per investor, closes each subscription with its outcome, and matures the listing. Closes G-E4 (the
    // outcome reaches the investor's S13 portfolio).
    executeDistribution: (listingId) => {
      const st = getState()
      const dist = st.distributions[listingId]
      if (!dist) return
      const investors = dist.investors.map((inv, i) => ({ ...inv, utr: inv.utr ?? `UTR${Date.now()}${i}` }))
      patch('distributions', listingId, { status: 'executed', investors })
      patch('listings', listingId, { status: 'matured' })
      investors.forEach(inv => {
        if (!inv.subscription_id) return
        patch('subscriptions', inv.subscription_id, {
          status: 'closed',
          distribution_outcome: { gross: inv.gross_paise, tds: inv.tds_paise, fee: inv.fee_paise, net: inv.net_paise },
        })
      })
      audit('Listing.Distributed', listingId)
    },

    _getState: getState,
  }
}
