// BC5 Assignment set (investor e-signatures gating disbursement). Paths per API_CATALOGUE.md.
import { postCommand, readById } from '../envelope.js'

const base = (listingId) => `/listings/${listingId}/assignment-set`

export const assignment = {
  // ── commands ──
  request:         (listingId)       => postCommand(`${base(listingId)}/request`, undefined),
  completeSigning: (listingId, body) => postCommand(`${base(listingId)}/complete-signing`, body),      // {investor_id}
  declareIncomplete: (listingId)     => postCommand(`${base(listingId)}/declare-incomplete`, undefined),
  recordLegFailed: (listingId, body) => postCommand(`${base(listingId)}/record-leg-failed`, body),     // {investor_id,reason}
  reinitiateLeg:   (listingId, body) => postCommand(`${base(listingId)}/reinitiate-leg`, body),        // {investor_id}
  // ── reads ──
  get: (listingId) => readById(base(listingId)),  // {assignment_set_id,status,signed_count,total_count,all_signed}
}
