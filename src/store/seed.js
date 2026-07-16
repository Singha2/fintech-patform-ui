// Seeds the shared store's normalized collections from the (already API-shaped) mockData.js.
// This is the ONLY place mockData is read into the store; screens then read/write via the store.
// At integration, the same collections hydrate from live by-id reads + the list endpoints (BE-4…BE-12).
import mockDataDefault from '../data/mockData.js'

function byId(arr, key) {
  return Object.fromEntries((arr ?? []).map(x => [x[key], x]))
}

export function seedFromMock(md = mockDataDefault) {
  // ── Suppliers (S3 has the full fields; include the S14 acting-as supplier if distinct) ──
  const suppliers = byId(md.S3?.suppliers, 'supplier_id')
  const s14sup = md.S14?.supplier
  if (s14sup && !suppliers[s14sup.supplier_id]) suppliers[s14sup.supplier_id] = s14sup

  // ── Buyers ──
  const buyers = byId(md.S4?.buyers, 'buyer_id')

  // ── Investors (merge the S10 onboarding view + the S13 portfolio view by investor_id) ──
  const investors = {}
  for (const inv of [md.S10?.investor, md.S13?.investor].filter(Boolean)) {
    investors[inv.investor_id] = { ...(investors[inv.investor_id] ?? {}), ...inv }
  }

  // ── Investor invites ──
  const invites = byId(md.S8?.invites, 'invite_id')

  // ── Invoices (merge the ops (S5), supplier (S14), and buyer (S15) views by invoice_id) ──
  // Tag S14 invoices with their supplier_id and S15 invoices with their buyer_id so the portals can scope
  // to "my invoices" via the store (enables supplier/buyer continuity).
  const invoices = {}
  const mergeInvoice = (i) => { if (i && i.invoice_id) invoices[i.invoice_id] = { ...(invoices[i.invoice_id] ?? {}), ...i } }
  const s14SupplierId = md.S14?.supplier?.supplier_id
  const s14SupplierName = md.S14?.supplier?.legal_name
  const s15BuyerId = md.S15?.buyer?.buyer_id
  ;(md.S5?.invoices ?? []).forEach(mergeInvoice)
  ;(md.S14?.invoices ?? []).forEach(i => mergeInvoice({ ...i, supplier_id: i.supplier_id ?? s14SupplierId, supplier_name: i.supplier_name ?? s14SupplierName }))
  ;(md.S15?.invoices ?? []).forEach(i => mergeInvoice({ ...i, buyer_id: i.buyer_id ?? s15BuyerId }))

  // ── Listings (merge the marketplace (S11), approval list (S5), detail (S12), and S14 nested listings) ──
  const listings = {}
  const mergeListing = (l) => { if (l && l.listing_id) listings[l.listing_id] = { ...(listings[l.listing_id] ?? {}), ...l } }
  ;(md.S11?.listings ?? []).forEach(mergeListing)
  ;(md.S5?.listings_for_approval ?? []).forEach(mergeListing)
  mergeListing(md.S12?.listing)
  ;(md.S14?.invoices ?? []).forEach(i => mergeListing(i.listing))

  // ── Subscriptions (keyed by subscription_id; tag with the S13 investor so the portfolio scopes to them) ──
  const s13InvestorId = md.S13?.investor?.investor_id
  const subscriptions = byId((md.S13?.subscriptions ?? []).map(s => ({ investor_id: s.investor_id ?? s13InvestorId, ...s })), 'subscription_id')

  // ── Disbursements + distributions (keyed by listing_id, per the plan) ──
  const disbursements = Object.fromEntries((md.S6?.disbursements ?? []).map(d => [d.listing_id, d]))
  const distributions = Object.fromEntries((md.S7?.distributions ?? []).map(d => [d.listing_id, d]))

  // ── Audit events (append-only projection; every store operation adds to this) ──
  const auditEvents = [...(md.S9?.events ?? [])]

  return { suppliers, buyers, investors, invites, invoices, listings, subscriptions, disbursements, distributions, auditEvents }
}
