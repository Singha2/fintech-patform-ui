// BC8 Supplier onboarding — commands + reads. Paths per backend docs/API_CATALOGUE.md; request shapes per
// API_ALIGNMENT.md §2. Commands return the envelope; transitions thread the current aggregate_version (v).
// The bearer is injected by the API client (set by AuthContext) — services never pass it.
import { postCommand, readById } from '../envelope.js'

const base = '/suppliers'

export const suppliers = {
  // ── commands ──
  create:                 (body)      => postCommand(`${base}/create`, body),                                        // {legal_name,constitution_type,pan,gstin,cin?}
  grantAgencyConsent:     (id, body, v) => postCommand(`${base}/${id}/grant-agency-consent`, body, { aggregateVersion: v }), // {scope}
  recordIdentityVerified: (id, v)     => postCommand(`${base}/${id}/record-identity-verified`, undefined, { aggregateVersion: v }),
  submitKyc:              (id, v)     => postCommand(`${base}/${id}/submit-kyc`, undefined, { aggregateVersion: v }),
  recordKycApproved:      (id, v)     => postCommand(`${base}/${id}/record-kyc-approved`, undefined, { aggregateVersion: v }),
  recordKycRejected:      (id, body, v) => postCommand(`${base}/${id}/record-kyc-rejected`, body, { aggregateVersion: v }),  // {reason}
  resubmitKyc:            (id, v)     => postCommand(`${base}/${id}/resubmit-kyc`, undefined, { aggregateVersion: v }),
  submitFinancialProfile: (id, body, v) => postCommand(`${base}/${id}/submit-financial-profile`, body, { aggregateVersion: v }), // {top_buyers?}
  recordCreditReview:     (id, body, v) => postCommand(`${base}/${id}/record-credit-review`, body, { aggregateVersion: v }),  // {exposure_cap_paise,risk_rating}
  recordMaaSigned:        (id, v)     => postCommand(`${base}/${id}/record-maa-signed`, undefined, { aggregateVersion: v }),
  activate:               (id, v)     => postCommand(`${base}/${id}/activate`, undefined, { aggregateVersion: v }),
  // ── reads ──
  get:      (id) => readById(`${base}/${id}`),                                          // {supplier_id,status,aggregate_version}
  list:     (q)  => readById(`${base}${q ? `?q=${encodeURIComponent(q)}` : ''}`),       // BE-4 (S3)
  listings: (id) => readById(`${base}/${id}/listings`),                                 // BE-11 supplier tracker (S14)
  kycFile:  (id) => readById(`${base}/${id}/kyc-file`),                                 // BE-2
}
