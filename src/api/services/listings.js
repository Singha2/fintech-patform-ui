// BC1 Listing lifecycle + ops-checks — commands + reads. Paths per API_CATALOGUE.md; shapes per API_ALIGNMENT §2.
// check_name canonical values: irn_validity, eway_bill_match, buyer_supplier_relationship, duplicate_check,
// supplier_exposure_cap, buyer_limit_headroom, document_completeness. outcome is 'passed' (omit for vendor checks).
import { postCommand, readById } from '../envelope.js'

const base = '/listings'

export const listings = {
  // ── commands ──
  create:            (body)      => postCommand(base, body),                                                    // {supplier_id,buyer_id,invoice_number,face_value_paise,invoice_date,tenor_days,irn?}
  startOpsChecks:    (id, v)     => postCommand(`${base}/${id}/start-ops-checks`, undefined, { aggregateVersion: v }),
  recordOpsCheck:    (id, body, v) => postCommand(`${base}/${id}/record-ops-check`, body, { aggregateVersion: v }), // {check_name,outcome?}
  completeOpsChecks: (id, v)     => postCommand(`${base}/${id}/complete-ops-checks`, undefined, { aggregateVersion: v }),
  requestBuyerAck:   (id, body, v) => postCommand(`${base}/${id}/request-buyer-ack`, body, { aggregateVersion: v }), // {sla_hours}
  recordBuyerAck:    (id, body, v) => postCommand(`${base}/${id}/record-buyer-ack`, body, { aggregateVersion: v }),  // {outcome,method?,evidence_ref?}
  snapshotAndReady:  (id, body, v) => postCommand(`${base}/${id}/snapshot-and-ready`, body, { aggregateVersion: v }), // {rate_bps}
  approveGoLive:     (id, v)     => postCommand(`${base}/${id}/approve-go-live`, undefined, { aggregateVersion: v }),
  declareFundingShortfall: (id, v) => postCommand(`${base}/${id}/declare-funding-shortfall`, undefined, { aggregateVersion: v }),
  attachInvoiceDoc:  (id, body)  => postCommand(`${base}/${id}/invoice-documents`, body),               // {document_id} — BC16 attach (stamps uploaded_by; gates document_completeness, DOC.3)
  // ── reads ──
  get:       (id)     => readById(`${base}/${id}`),                                     // {listing_id,status,funding_target,va_id,aggregate_version}
  list:      (status) => readById(`${base}${status ? `?status=${status}` : ''}`),       // BE-6 / BE-14 (S5/S11)
  detail:    (id)     => readById(`${base}/${id}/detail`),                              // BE-10 rich display (S12)
  opsChecks: (id)     => readById(`${base}/${id}/ops-checks`),                          // BE-6 per-check outcomes (S5)
}
