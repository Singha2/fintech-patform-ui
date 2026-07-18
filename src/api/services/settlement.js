// BC4 Settlement — disbursement (maker-checker) + maturity + the disbursement/recon reads. Paths per
// API_CATALOGUE.md; shapes per API_ALIGNMENT §2. Money inflow arrives via the banking webhook, not here.
import { postCommand, readById } from '../envelope.js'

export const settlement = {
  // ── disbursement commands (S6) ──
  disbursementDraft:   (listingId) => postCommand(`/listings/${listingId}/disbursement/draft`, undefined),
  disbursementApprove: (listingId) => postCommand(`/listings/${listingId}/disbursement/approve`, undefined),
  // ── maturity (S7) ──
  recordMaturity:      (listingId, body) => postCommand(`/listings/${listingId}/record-maturity`, body),  // {amount_paise,utr}
  // ── reads ──
  getDisbursement:       (listingId) => readById(`/listings/${listingId}/disbursement`),          // {payout_instruction_id,status,gross_amount,listing_status}
  getDisbursementDetail: (listingId) => readById(`/listings/${listingId}/disbursement/detail`),
  disbursementQueue:     ()          => readById('/disbursements'),                                // BE-7 queue (S6)
  reconciliation:        ()          => readById('/reconciliation'),                               // BE-8 recon (S7)
}
