// Model mapping: the backend unifies invoice+listing in ONE aggregate (deal_listing_status, one listing_id),
// while the mock splits them into `invoices` and `listings` keyed by separate ids. These mappers translate a
// backend listing/detail into the store's split shapes so the existing selectors (opsInvoices, listingDetail,
// supplierInvoices, marketplaceListings) keep working unchanged. The backend listing_id is used as BOTH the
// store invoice_id and listing_id.

// backend deal_listing_status → the mock invoice status (S5 checks tab / S14 tracker invoice view)
const INVOICE_STATUS = {
  draft: 'submitted',
  operational_checks_in_progress: 'ops_checks_in_progress',
  awaiting_acknowledgment: 'ops_checks_in_progress',
  held_for_review: 'ops_checks_in_progress',
  ready_for_review: 'ops_checks_passed',
  rejected_operational: 'ops_checks_failed',
  acknowledgment_failed: 'ops_checks_failed',
  // once listed and beyond, the invoice is 'listed'
  live: 'listed', fully_funded: 'listed', disbursed: 'listed', in_repayment: 'listed',
  matured_payment_received: 'listed', distributed: 'listed', closed: 'listed',
}
// backend deal_listing_status → the mock listing status (S5 approval / S11 marketplace / S12 / S14 listing view)
const LISTING_STATUS = {
  ready_for_review: 'ready_for_review',
  live: 'live', fully_funded: 'fully_funded', disbursed: 'disbursed',
  in_repayment: 'disbursed', matured_payment_received: 'matured', distributed: 'matured', closed: 'closed',
}
export const toInvoiceStatus = (s) => INVOICE_STATUS[s] ?? s
export const toListingStatus = (s) => LISTING_STATUS[s] ?? s

// backend ops-check outcome → the mock's pass/fail/pending vocabulary (unknowns pass through).
const CHECK_OUTCOME = { passed: 'pass', failed: 'fail', not_applicable: 'pass', pending: 'pending', in_progress: 'pending' }

// GET /listings/{id}/ops-checks [{check_name, outcome, verification_id, checked_at}] → the mock's check_outcomes map.
export function mapChecks(opsChecks) {
  return Object.fromEntries((opsChecks ?? []).map((c) => [
    c.check_name, {
      outcome: CHECK_OUTCOME[c.outcome] ?? c.outcome,
      detail: c.verification_id ? `Ref ${c.verification_id}` : (c.outcome === 'not_applicable' ? 'N/A' : ''),
      checked_at: c.checked_at,
    },
  ]))
}

// GET /listings/{id}/detail (+ ops-checks) → the store entities S12's listingDetail() composes from.
// Returns a patch to MERGE into the store (listings/invoices/buyers/suppliers keyed by id).
export function mapListingDetail(d, opsChecks = []) {
  const id = d.listing_id
  const check_outcomes = mapChecks(opsChecks)
  return {
    listings: { [id]: {
      listing_id: id, invoice_id: id, status: toListingStatus(d.status),
      funding_target: d.funding_target, committed_total: d.committed_total ?? 0, va_id: d.va_id,
      virtual_account_number: d.virtual_account?.account_number ?? null,
      virtual_account_ifsc: d.virtual_account?.ifsc ?? null,
      pricing_snapshot: d.pricing_snapshot, rate_bps: d.pricing_snapshot?.rate_bps ?? null,
      tenor_days: d.invoice?.tenor_days, due_date: d.invoice?.due_date,
      buyer_id: d.buyer?.buyer_id ?? null, buyer_name: d.buyer?.legal_name ?? null, buyer_sector: d.buyer?.sector ?? null,
      supplier_id: d.supplier?.supplier_id ?? null, supplier_name: d.supplier?.legal_name ?? null,
      funding_window_close_at: null,
    } },
    invoices: { [id]: {
      invoice_id: id, invoice_number: d.invoice?.invoice_number, face_value: d.invoice?.face_value_paise,
      tenor_days: d.invoice?.tenor_days, invoice_date: d.invoice?.invoice_date, due_date: d.invoice?.due_date,
      irn: d.invoice?.irn ?? null, status: toInvoiceStatus(d.status), check_outcomes,
      supplier_id: d.supplier?.supplier_id ?? null, buyer_id: d.buyer?.buyer_id ?? null,
    } },
    ...(d.buyer ? { buyers: { [d.buyer.buyer_id]: {
      buyer_id: d.buyer.buyer_id, legal_name: d.buyer.legal_name, sector: d.buyer.sector, status: d.buyer.status,
      credit_limit_paise: d.buyer.credit_limit_paise, mca_cin: d.buyer.mca_cin, gstin: d.buyer.gstin,
    } } } : {}),
    ...(d.supplier ? { suppliers: { [d.supplier.supplier_id]: {
      supplier_id: d.supplier.supplier_id, legal_name: d.supplier.legal_name,
      constitution_type: d.supplier.constitution_type, pan: d.supplier.pan, gstin: d.supplier.gstin, status: d.supplier.status,
    } } } : {}),
  }
}

// GET /listings [{listing_id, invoice_number, supplier_id, buyer_id, face_value_paise, tenor_days, status,
// funding_target, rate_bps}] → the store's split invoices + listings for S5 (ops queue + approval list).
// Names aren't in this read (BE-6 returns ids) → supplier_name/buyer_name left blank; check_outcomes come from
// the per-listing ops-checks read (loaded on select). The backend listing_id is used as both ids.
export function mapListingsList(rows) {
  const invoices = {}, listings = {}
  for (const l of rows ?? []) {
    const id = l.listing_id
    invoices[id] = {
      invoice_id: id, invoice_number: l.invoice_number, face_value: l.face_value_paise, tenor_days: l.tenor_days,
      status: toInvoiceStatus(l.status), supplier_id: l.supplier_id ?? null, buyer_id: l.buyer_id ?? null,
      supplier_name: null, buyer_name: null, irn: null, invoice_date: null, due_date: null,
    }
    listings[id] = {
      listing_id: id, invoice_id: id, invoice_number: l.invoice_number, status: toListingStatus(l.status),
      funding_target: l.funding_target, committed_total: 0, rate_bps: l.rate_bps, tenor_days: l.tenor_days,
      supplier_id: l.supplier_id ?? null, buyer_id: l.buyer_id ?? null, supplier_name: null, buyer_name: null,
      maker_id: null, maker_name: null,
    }
  }
  return { invoices, listings }
}

// GET /disbursements [{payout_instruction_id, listing_id, status, gross_amount, net_amount, maker_id, checker_id,
// listing_status, created_at}] → the store's disbursement shape (keyed by listing_id) for the S6 queue. Names
// aren't in this read (BE-7 returns ids); a drafted instruction implies the fully_funded ∧ all_signed gate passed.
export function mapDisbursements(rows) {
  const disbursements = {}
  for (const d of rows ?? []) {
    disbursements[d.listing_id] = {
      disbursement_id: d.payout_instruction_id, listing_id: d.listing_id,
      net_amount_paise: d.net_amount, status: d.status, listing_status: d.listing_status,
      maker_id: d.maker_id, checker_id: d.checker_id, all_signed: true,
      supplier_name: null, buyer_name: null, due_disbursement_date: null, utr: null,
    }
  }
  return { disbursements }
}

// GET /suppliers/{id}/listings → store invoices (with a nested `listing`) for the S14 tracker. supplierInvoices()
// filters store.invoices by supplier_id. buyer_name isn't in this read (BE-11) → left blank.
export function mapSupplierListings(rows, supplierId) {
  const invoices = {}
  for (const l of rows ?? []) {
    invoices[l.listing_id] = {
      invoice_id: l.listing_id, invoice_number: l.invoice_number, face_value: l.face_value_paise,
      invoice_date: l.invoice_date, due_date: l.due_date, tenor_days: l.tenor_days, irn: null,
      status: toInvoiceStatus(l.status), supplier_id: supplierId,
      listing: (l.funding_target != null || toListingStatus(l.status) !== l.status) ? {
        listing_id: l.listing_id, status: toListingStatus(l.status), funding_target: l.funding_target,
        committed_total: l.committed_total ?? 0, investor_count: null, funding_window_close_at: null,
        rate_bps: l.rate_bps, disbursed_at: null, disbursement_utr: null,
      } : null,
    }
  }
  return { invoices }
}
