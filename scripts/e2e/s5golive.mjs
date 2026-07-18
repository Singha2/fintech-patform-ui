// E2E S5 go-live via the REAL two-ops pipeline (now unblocked by ops2@dev.local).
// Mirrors S5.jsx's command sequence, plus the invoice-document upload (BC16) that DOC.3 requires but the UI
// does not yet build. Proves the backend contracts S5's go-live writes target: complete-ops-checks →
// request/record-buyer-ack → snapshot-and-ready (OPS) → approve-go-live (TREASURY, checker ≠ maker).
import { login, api, cmd, get, check, summary } from './lib.mjs'

const BASE = 'http://localhost:8080/api/v1'
const j = (o) => JSON.stringify(o)
const VERS = async (lid, bearer) => (await get(`/listings/${lid}`, bearer)).data?.aggregate_version

// seed-info gives the active supplier/buyer to build a fresh invoice/listing from
const info = (await get('/dev/seed-info')).data
const ops = await login('ops@dev.local')
const ops2 = await login('ops2@dev.local')       // DOC.3: document_completeness recorder ≠ uploader
const treasury = await login('treasury@dev.local')

console.log('\n── S5 go-live (real two-ops pipeline) ──────────')

// 1. create listing from a fresh invoice (tenor 45d → matches the seeded 31_60d pricing band)
const create = await cmd('/listings', { bearer: ops, body: {
  supplier_id: info.supplier_id, buyer_id: info.buyer_id,
  invoice_number: `INV-GL-${(process.hrtime.bigint() % 100000000n).toString()}`,
  face_value_paise: 5000000, invoice_date: '2026-06-01', tenor_days: 45,
} })
check('create listing', create.ok, `${create.status} ${create.data?.error_code ?? ''}`)
const lid = create.data.aggregate_id

// 2. start ops-checks
const start = await cmd(`/listings/${lid}/start-ops-checks`, { bearer: ops, version: await VERS(lid, ops) })
check('start-ops-checks', start.ok, `${start.status} ${start.data?.error_code ?? ''}`)

// 3. upload + attach the invoice PDF (uploader = ops@)
const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF')
const initDoc = await cmd('/documents', { bearer: ops, body: { kind: 'invoice', content_type: 'application/pdf', declared_size: pdf.length } })
check('document initiate', initDoc.ok, `${initDoc.status} ${initDoc.data?.error_code ?? ''}`)
const docId = initDoc.data.document_id ?? initDoc.data.aggregate_id
const put = await fetch(`${BASE}/documents/${docId}/content`, { method: 'PUT', headers: { 'Authorization': `Bearer ${ops}`, 'Content-Type': 'application/pdf' }, body: pdf })
check('document content upload', put.ok, `${put.status}`)
const fin = await cmd(`/documents/${docId}/finalize`, { bearer: ops })
check('document finalize', fin.ok, `${fin.status} ${fin.data?.error_code ?? ''}`)
const attach = await cmd(`/listings/${lid}/invoice-documents`, { bearer: ops, body: { document_id: docId } })
check('attach invoice-document (ops@)', attach.ok, `${attach.status} ${attach.data?.error_code ?? ''}`)

// 4. record ops-checks. irn_validity is a vendor check → recorded with NO outcome (backend derives).
const irn = await cmd(`/listings/${lid}/record-ops-check`, { bearer: ops, body: { check_name: 'irn_validity' }, version: await VERS(lid, ops) })
check('record irn_validity (vendor, no outcome)', irn.ok, `${irn.status} ${irn.data?.error_code ?? ''}`)
// Non-vendor checks passed by ops@; document_completeness recorded by ops2@ (recorder ≠ uploader).
const opsChecks = ['eway_bill_match', 'buyer_supplier_relationship', 'duplicate_check', 'supplier_exposure_cap', 'buyer_limit_headroom']
for (const name of opsChecks) {
  const r = await cmd(`/listings/${lid}/record-ops-check`, { bearer: ops, body: { check_name: name, outcome: 'passed' }, version: await VERS(lid, ops) })
  check(`record ${name}`, r.ok, `${r.status} ${r.data?.error_code ?? ''}`)
}
// DOC.3: same ops as uploader must be rejected; different ops (ops2) accepted
const dcSelf = await cmd(`/listings/${lid}/record-ops-check`, { bearer: ops, body: { check_name: 'document_completeness', outcome: 'passed' }, version: await VERS(lid, ops) })
check('document_completeness by uploader → rejected (DOC.3)', !dcSelf.ok, `${dcSelf.status} ${dcSelf.data?.error_code ?? j(dcSelf.data)}`)
const dc = await cmd(`/listings/${lid}/record-ops-check`, { bearer: ops2, body: { check_name: 'document_completeness', outcome: 'passed' }, version: await VERS(lid, ops2) })
check('document_completeness by ops2 → accepted', dc.ok, `${dc.status} ${dc.data?.error_code ?? j(dc.data)}`)

// 5. complete-ops-checks → request + record buyer-ack → snapshot-and-ready {rate_bps} (all OPS, version threaded)
const complete = await cmd(`/listings/${lid}/complete-ops-checks`, { bearer: ops, version: await VERS(lid, ops) })
check('complete-ops-checks', complete.ok, `${complete.status} ${complete.data?.error_code ?? j(complete.data)}`)
const reqAck = await cmd(`/listings/${lid}/request-buyer-ack`, { bearer: ops, body: { sla_hours: 48 }, version: await VERS(lid, ops) })
check('request-buyer-ack', reqAck.ok, `${reqAck.status} ${reqAck.data?.error_code ?? ''}`)
const recAck = await cmd(`/listings/${lid}/record-buyer-ack`, { bearer: ops, body: { outcome: 'acknowledged' }, version: await VERS(lid, ops) })
check('record-buyer-ack', recAck.ok, `${recAck.status} ${recAck.data?.error_code ?? ''}`)
const snap = await cmd(`/listings/${lid}/snapshot-and-ready`, { bearer: ops, body: { rate_bps: 1200 }, version: await VERS(lid, ops) })
check('snapshot-and-ready', snap.ok, `${snap.status} ${snap.data?.error_code ?? j(snap.data)}`)
const ready = await get(`/listings/${lid}`, ops)
check('listing → ready_for_review', ready.data?.status === 'ready_for_review', ready.data?.status)

// 6. approve-go-live — TREASURY checker (≠ ops maker who ran snapshot)
const opsGoLive = await cmd(`/listings/${lid}/approve-go-live`, { bearer: ops, version: await VERS(lid, ops) })
check('go-live by ops (maker) → rejected', !opsGoLive.ok, `${opsGoLive.status} ${opsGoLive.data?.error_code ?? ''}`)
const golive = await cmd(`/listings/${lid}/approve-go-live`, { bearer: treasury, version: await VERS(lid, treasury) })
check('approve-go-live (treasury)', golive.ok, `${golive.status} ${golive.data?.error_code ?? j(golive.data)}`)
const live = await get(`/listings/${lid}`, treasury)
check('listing → live + VA', live.data?.status === 'live' && !!live.data?.va_id, `status=${live.data?.status} va=${live.data?.va_id}`)

process.exit(summary() ? 0 : 1)
