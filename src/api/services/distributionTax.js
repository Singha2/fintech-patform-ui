// BC12 Distribution + tax (TDS ledger, Form 16A, per-investor breakdown). Paths per API_CATALOGUE.md.
import { postCommand, readById } from '../envelope.js'
import { request } from '../client.js'

export const distributionTax = {
  // ── distribution commands (S7) ──
  distributionDraft:   (listingId) => postCommand(`/listings/${listingId}/distribution/draft`, undefined),
  distributionApprove: (listingId) => postCommand(`/listings/${listingId}/distribution/approve`, undefined),
  // ── reads (S7 / S13) ──
  getDistribution:   (listingId) => readById(`/listings/${listingId}/distribution`),            // {payout_instruction_id,status,gross_amount,net_amount,total_tds_amount,listing_status,terminal_outcome}
  distributionInvestors: (listingId) => readById(`/listings/${listingId}/distribution/investors`), // BE-8 per-investor breakdown
  deductions: (investorId, fy) => readById(`/investors/${investorId}/tax/deductions${fy ? `?fy=${fy}` : ''}`), // [{listing_id,fy_code,gross_paise,tds_amount_paise,fee_paise,net_paise,challan_ref}]
  statements: (investorId) => readById(`/investors/${investorId}/tax/statements`),              // [{period,kind,generated_at,doc_hash}]
  // ── Form 16A (issue command + binary download) ──
  issueForm16a: (investorId, fyCode) => postCommand(`/investors/${investorId}/tax/form-16a/${fyCode}/issue`, undefined),
  getForm16a:   (investorId, fyCode) => request('GET', `/investors/${investorId}/tax/form-16a/${fyCode}`, { raw: true }).then(r => r.data), // Blob
}
