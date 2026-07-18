// BC7 Investor invites + onboarding — commands + reads. Paths per API_CATALOGUE.md; shapes per API_ALIGNMENT §2.
import { postCommand, readById } from '../envelope.js'

const base = '/investors'

export const investors = {
  // ── commands ──
  issueInvite:                 (body)      => postCommand('/investor-invites/issue', body),                              // {email,phone}
  signUp:                      (body)      => postCommand(`${base}/sign-up`, body),                                      // {invite_id,email,phone,sub_type}
  recordIdentityVerified:      (id, body, v) => postCommand(`${base}/${id}/record-identity-verified`, body, { aggregateVersion: v }), // {pan,aadhaar_last4}
  submitKyc:                   (id, v)     => postCommand(`${base}/${id}/submit-kyc`, undefined, { aggregateVersion: v }),
  assessSuitability:           (id, body, v) => postCommand(`${base}/${id}/assess-suitability`, body, { aggregateVersion: v }),  // {mismatch?}
  acknowledgeSuitabilityOverride: (id, body, v) => postCommand(`${base}/${id}/acknowledge-suitability-override`, body, { aggregateVersion: v }), // {override_text}
  completeFinancialProfile:    (id, body, v) => postCommand(`${base}/${id}/complete-financial-profile`, body, { aggregateVersion: v }), // {bank_account_last4}
  recordKycApproved:           (id, v)     => postCommand(`${base}/${id}/record-kyc-approved`, undefined, { aggregateVersion: v }),
  recordKycRejected:           (id, body, v) => postCommand(`${base}/${id}/record-kyc-rejected`, body, { aggregateVersion: v }), // {reason}
  resubmitKyc:                 (id, v)     => postCommand(`${base}/${id}/resubmit-kyc`, undefined, { aggregateVersion: v }),
  recordMiaSigned:             (id, v)     => postCommand(`${base}/${id}/record-mia-signed`, undefined, { aggregateVersion: v }),
  activate:                    (id, v)     => postCommand(`${base}/${id}/activate`, undefined, { aggregateVersion: v }),
  // ── reads ──
  get:         (id) => readById(`${base}/${id}`),                                       // {investor_id,status,aggregate_version}
  listInvites: (status) => readById(`/investor-invites${status ? `?status=${status}` : ''}`), // BE-9 (S8)
  kycFile:     (id) => readById(`${base}/${id}/kyc-file`),                              // BE-2
}
