// BC9 Buyer management — commands + reads. Paths per API_CATALOGUE.md; shapes per API_ALIGNMENT §2.
import { postCommand, readById } from '../envelope.js'

const base = '/buyers'

export const buyers = {
  // ── commands ──
  nominate:                 (body)      => postCommand(`${base}/nominate`, body),                                       // {legal_name,mca_cin,gstin,sector}
  recordIdentityVerified:   (id, v)     => postCommand(`${base}/${id}/record-identity-verified`, undefined, { aggregateVersion: v }),
  recordCreditAssessment:   (id, body, v) => postCommand(`${base}/${id}/record-credit-assessment`, body, { aggregateVersion: v }), // {credit_limit_paise}
  startEngagement:          (id, v)     => postCommand(`${base}/${id}/start-engagement`, undefined, { aggregateVersion: v }),
  designateAckUser:         (id, body, v) => postCommand(`${base}/${id}/designate-ack-user`, body, { aggregateVersion: v }),  // {email,phone,display_name}
  confirmPaymentInstruction:(id, v)     => postCommand(`${base}/${id}/confirm-payment-instruction`, undefined, { aggregateVersion: v }),
  activate:                 (id, v)     => postCommand(`${base}/${id}/activate`, undefined, { aggregateVersion: v }),
  kybVerification:          (id, body, v) => postCommand(`${base}/${id}/kyb-verification`, body, { aggregateVersion: v }),  // {verified,document_id?}
  // ── reads ──
  get:    (id) => readById(`${base}/${id}`),                                            // {buyer_id,status,aggregate_version}
  list:   ()   => readById(base),                                                       // BE-5 (S4)
  getKyb: (id) => readById(`${base}/${id}/kyb-verification`),                           // {kyb_verified,kyb_verified_by,kyb_verified_at,kyb_document_id}
  // ── buyer portal reads (BE-15, S15) — own-scoped for an ack-user; mismatch → 403 cross_tenant_read ──
  ackInvoices:        (id) => readById(`${base}/${id}/ack-invoices`),                   // [{listing_id,invoice_number,supplier_name,face_value_paise,invoice_date,due_date,ack_status,sla_hours,requested_at,acknowledged_at}]
  paymentInstruction: (id) => readById(`${base}/${id}/payment-instruction`),            // {present,effective_from?,confirmed_at?} (metadata only — bank fields not yet captured)
}
