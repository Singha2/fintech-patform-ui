// E2E BE-15 / DL-BE-090 — buyer portal: ack-user passwordless login + own-scoped buyer reads + self-ack.
import { login, api, cmd, get, check, summary } from './lib.mjs'
const BASE = 'http://localhost:8080/api/v1'
const j = o => JSON.stringify(o)
const VERS = async (lid, b) => (await get(`/listings/${lid}`, b)).data?.aggregate_version

// passwordless ack-user login (OTP-only): request-otp {email} → /dev/last-otp → verify-otp → bearer
async function loginAckUser(email) {
  const req = await api('POST', '/auth/login/ack-user/request-otp', { body: { email } })
  const otp = await api('GET', `/dev/last-otp?email=${encodeURIComponent(email)}`)
  const v = await api('POST', '/auth/login/verify-otp', { body: { challenge_id: req.data.challenge_id, code: otp.data.code } })
  return v.data.bearer
}

// Drive a fresh listing for the dev buyer to awaiting_acknowledgment with an OUTSTANDING ops ack request
// (self-ack requires buyer_ack.status='requested'). Mirrors the S5 ops-check pipeline up to request-buyer-ack.
async function listingAwaitingAck() {
  const info = (await get('/dev/seed-info')).data
  const ops = await login('ops@dev.local'); const ops2 = await login('ops2@dev.local')
  const create = await cmd('/listings', { bearer: ops, body: {
    supplier_id: info.supplier_id, buyer_id: info.buyer_id,
    invoice_number: `INV-BA-${(process.hrtime.bigint() % 100000000n)}`,
    face_value_paise: 5000000, invoice_date: '2026-06-01', tenor_days: 45 } })
  const lid = create.data.aggregate_id
  await cmd(`/listings/${lid}/start-ops-checks`, { bearer: ops, version: await VERS(lid, ops) })
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF')
  const initDoc = await cmd('/documents', { bearer: ops, body: { kind: 'invoice', content_type: 'application/pdf', declared_size: pdf.length } })
  const docId = initDoc.data.document_id
  await fetch(`${BASE}/documents/${docId}/content`, { method: 'PUT', headers: { Authorization: `Bearer ${ops}`, 'Content-Type': 'application/pdf' }, body: pdf })
  await cmd(`/documents/${docId}/finalize`, { bearer: ops })
  await cmd(`/listings/${lid}/invoice-documents`, { bearer: ops, body: { document_id: docId } })
  await cmd(`/listings/${lid}/record-ops-check`, { bearer: ops, body: { check_name: 'irn_validity' }, version: await VERS(lid, ops) })
  for (const n of ['eway_bill_match', 'buyer_supplier_relationship', 'duplicate_check', 'supplier_exposure_cap', 'buyer_limit_headroom'])
    await cmd(`/listings/${lid}/record-ops-check`, { bearer: ops, body: { check_name: n, outcome: 'passed' }, version: await VERS(lid, ops) })
  await cmd(`/listings/${lid}/record-ops-check`, { bearer: ops2, body: { check_name: 'document_completeness', outcome: 'passed' }, version: await VERS(lid, ops2) })
  await cmd(`/listings/${lid}/complete-ops-checks`, { bearer: ops, version: await VERS(lid, ops) })
  await cmd(`/listings/${lid}/request-buyer-ack`, { bearer: ops, body: { sla_hours: 48 }, version: await VERS(lid, ops) })
  return { lid, ops }
}

console.log('── BE-15 buyer portal (ack-user login + reads + self-ack) ──')
const { lid } = await listingAwaitingAck()

// 1. passwordless ack-user login → session with buyer_id
const ack = await loginAckUser('ack@dev.local')
const sess = await api('GET', '/auth/session', { bearer: ack })
check('session kind=acknowledgment_user', sess.data?.kind === 'acknowledgment_user', sess.data?.kind)
const buyerId = sess.data?.buyer_id
check('session carries buyer_id', !!buyerId, buyerId)

// 2. own-scoped reads
const inv = await get(`/buyers/${buyerId}/ack-invoices`, ack)
check('ack-invoices read 200 (array)', inv.status === 200 && Array.isArray(inv.data), `${inv.status}`)
const row = inv.data?.find(r => r.listing_id === lid)
check('our awaiting-ack listing is listed', !!row, `ack_status=${row?.ack_status} count=${inv.data?.length}`)
const pi = await get(`/buyers/${buyerId}/payment-instruction`, ack)
check('payment-instruction read 200', pi.status === 200, j(pi.data))

// 3. own-scoping: reading a different buyer → 403 cross_tenant_read
const x = await get('/buyers/00000000-0000-0000-0000-000000000009/ack-invoices', ack)
check('cross-tenant ack-invoices → 403', x.status === 403 && x.data?.error_code === 'cross_tenant_read', `${x.status} ${x.data?.error_code ?? ''}`)

// 4. self-ack own listing (acknowledged only), then confirm it flipped
const selfAck = await cmd(`/listings/${lid}/record-buyer-ack`, { bearer: ack, body: { outcome: 'acknowledged' }, version: await VERS(lid, ack) })
check('buyer self-ack 2xx', selfAck.ok, `${selfAck.status} ${selfAck.data?.error_code ?? ''}`)
const after = await get(`/buyers/${buyerId}/ack-invoices`, ack)
check('listing now acknowledged', after.data?.find(r => r.listing_id === lid)?.ack_status === 'acknowledged', after.data?.find(r => r.listing_id === lid)?.ack_status)

// 5. no S5 regression: ops-on-behalf record-buyer-ack still works on a fresh awaiting-ack listing
const second = await listingAwaitingAck()
const opsAck = await cmd(`/listings/${second.lid}/record-buyer-ack`, { bearer: second.ops, body: { outcome: 'acknowledged' }, version: await VERS(second.lid, second.ops) })
check('ops-on-behalf ack still 2xx', opsAck.ok, `${opsAck.status} ${opsAck.data?.error_code ?? ''}`)

process.exit(summary() ? 0 : 1)
