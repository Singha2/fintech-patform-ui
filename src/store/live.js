// Live loaders — fetch-into-store on mount (DATA_MODE=live). Each loader = { mode, load }:
//  - mode 'replace': load() returns a whole collection keyed by id → replaces the seed collection (lists).
//  - mode 'merge':   load(...args) returns entities to upsert INTO collections (by-id detail reads).
// load() maps the backend read to the store's normalized shape; the store's selectors then read the hydrated
// state exactly as they do the mock seed — so screens never change between mock and live.
import { suppliers, buyers, investors, listings, settlement, dashboard } from '../api/services/index.js'
import { mapListingDetail, mapSupplierListings, mapListingsList, mapChecks, mapDisbursements } from './mappers.js'

const byId = (arr, key) => Object.fromEntries((arr ?? []).map((x) => [x[key], x]))

export const liveLoaders = {
  // ── list reads (replace the seed collection) ──
  suppliers:    { mode: 'replace', load: async () => ({ suppliers: byId(await suppliers.list(), 'supplier_id') }) },       // BE-4 (S3)
  buyers:       { mode: 'replace', load: async () => ({ buyers: byId(await buyers.list(), 'buyer_id') }) },                // BE-5 (S4)
  invites:      { mode: 'replace', load: async () => ({ invites: byId(await investors.listInvites(), 'invite_id') }) },    // BE-9 (S8)
  listings:     { mode: 'replace', load: async () => ({ listings: byId(await listings.list(), 'listing_id') }) },          // BE-6 (S5)
  marketplace:  { mode: 'replace', load: async () => ({ listings: byId(await listings.list('live'), 'listing_id') }) },    // BE-14 (S11)
  disbursements:{ mode: 'replace', load: async () => mapDisbursements(await settlement.disbursementQueue()) },              // BE-7 (S6)
  dashboard:    { mode: 'replace', load: async () => {                                                                     // BE-12 (S2)
    const [stats, queues] = await Promise.all([dashboard.stats(), dashboard.workQueues()])
    return { _stats: stats, _queues: queues }
  } },

  // ── S5 ops queue + approval list: GET /listings → both invoices (ops checks tab) and listings (approval) ──
  opsListings: { mode: 'replace', load: async () => mapListingsList(await listings.list()) },                             // BE-6 (S5)
  // per-invoice ops-checks, merged into the invoice's check_outcomes when a row is opened on S5
  opsChecks: { mode: 'merge', load: async (listingId) =>                                                                  // BE-6 (S5 select)
    listingId ? { invoices: { [listingId]: { check_outcomes: mapChecks(await listings.opsChecks(listingId)) } } } : {} },

  // ── by-id reads (merge entities; map the backend's unified listing → the mock's split invoice/listing) ──
  listingDetail: { mode: 'merge', load: async (listingId) => {                                                            // BE-10 (S12)
    const [detail, opsChecks] = await Promise.all([listings.detail(listingId), listings.opsChecks(listingId).catch(() => [])])
    return mapListingDetail(detail, opsChecks)
  } },
  supplierListings: { mode: 'merge', load: async (supplierId) =>                                                          // BE-11 (S14)
    mapSupplierListings(await suppliers.listings(supplierId), supplierId) },
}
