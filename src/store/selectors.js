// Read selectors — mirror the backend reads. Each is annotated with the live target it will delegate to at
// integration (an existing by-id GET, or a still-to-build list endpoint BE-x). Until those ship, these compose
// the view client-side from the store (the projection that stands in for the thin backend read side).
const values = (o) => Object.values(o ?? {})

export function makeSelectors(state) {
  return {
    // ── by-id reads (live: the existing GET /…/{id}) ──
    getSupplier:      (id) => state.suppliers[id] ?? null,
    getBuyer:         (id) => state.buyers[id] ?? null,
    getInvestor:      (id) => state.investors[id] ?? null,
    getInvite:        (id) => state.invites[id] ?? null,
    getInvoice:       (id) => state.invoices[id] ?? null,
    getListing:       (id) => state.listings[id] ?? null,
    getSubscription:  (id) => state.subscriptions[id] ?? null,
    getDisbursement:  (listingId) => state.disbursements[listingId] ?? null,   // live: GET /listings/{id}/disbursement
    getDistribution:  (listingId) => state.distributions[listingId] ?? null,   // live: GET /listings/{id}/distribution

    // ── lists / projections (live targets in the backend spec) ──
    listSuppliers:    () => values(state.suppliers),                                             // BE-4
    listBuyers:       () => values(state.buyers),                                                // BE-5
    listInvites:      () => values(state.invites),                                               // BE-9
    listInvoices:     () => values(state.invoices),                                              // (part of BE-6/G4)
    // Invoices in the ops pipeline (S5 checks tab): submitted or mid-checks, not yet terminal. BE-4/G4.
    opsInvoices:      () => values(state.invoices).filter(i => ['submitted', 'ops_checks_in_progress', 'ops_checks_passed', 'ops_checks_failed'].includes(i.status)),
    supplierInvoices: (supplierId) => values(state.invoices).filter(i => i.supplier_id === supplierId), // BE-11 (supplier tracker)
    buyerInvoices:    (buyerId) => values(state.invoices).filter(i => i.buyer_id === buyerId),   // BE-15 (buyer portal)
    listListings:     (status) => values(state.listings).filter(l => !status || l.status === status), // BE-6
    // Detail view-model for S12 — the listing plus its linked invoice/buyer/supplier (nulls where unlinked,
    // the screen falls back to its seeded sample). Keyed off the clicked listing_id — closes G-C3. BE-6/BE-14.
    listingDetail:    (listingId) => {
      const listing = state.listings[listingId]
      if (!listing) return null
      return {
        listing,
        invoice:  listing.invoice_id ? state.invoices[listing.invoice_id] ?? null : null,
        buyer:    listing.buyer_id ? state.buyers[listing.buyer_id] ?? null : null,
        supplier: listing.supplier_id ? state.suppliers[listing.supplier_id] ?? null : null,
      }
    },
    marketplaceListings: () => values(state.listings).filter(l => l.status === 'live' || l.status === 'fully_funded'), // BE-14 / M10-full
    supplierListings: (supplierId) => values(state.listings).filter(l => l.supplier_id === supplierId), // BE-11
    disbursementQueue: () => values(state.disbursements),                                        // BE-7
    distributionsList: () => values(state.distributions),                                        // BE-8 (S7 queue)
    distributionInvestors: (listingId) => state.distributions[listingId]?.investors ?? [],       // BE-8
    // Investor's positions (subscriptions scoped to them). BE-14 / M10-full.
    investorPortfolio: (investorId) => values(state.subscriptions).filter(s => !investorId || s.investor_id === investorId),
    // Portfolio summary computed from the investor's positions (backend: BE-14 summary; mock derives it live).
    investorSummary: (investorId) => {
      const subs = values(state.subscriptions).filter(s => !investorId || s.investor_id === investorId)
      const closed = subs.filter(s => s.distribution_outcome)
      const active = subs.filter(s => !['closed', 'cancelled_by_investor', 'refunded', 'loss_realised'].includes(s.status))
      return {
        total_deployed_paise: active.reduce((a, s) => a + (s.amount ?? 0), 0),
        total_returned_paise: closed.reduce((a, s) => a + (s.distribution_outcome?.net ?? 0), 0),
        active_positions: active.length,
        matured_positions: closed.length,
      }
    },
    auditEvents:      () => state.auditEvents,                                                    // BE-13 / M17

    // ── live dashboard (BE-12): the hydrated stats object + queue counts (populated by the 'dashboard' loader) ──
    liveStats:  () => state._stats ?? null,
    liveQueues: () => state._queues ?? [],

    // ── dashboard (live: BE-12; scaffold computes simple counts from the write collections) ──
    dashboardStats: () => ({
      active_listings:  values(state.listings).filter(l => l.status === 'live').length,
      suppliers_active: values(state.suppliers).filter(s => s.status === 'active').length,
      buyers_active:    values(state.buyers).filter(b => b.status === 'active').length,
      investors_active: values(state.investors).filter(i => i.status === 'active').length,
    }),
  }
}
