// E2E S14 Submit Invoice — the real origination chain the supplier portal drives (acting-as, OPS):
// create listing (POST /listings → deal_invoice 'submitted') → BC16 doc flow (initiate → PUT → finalize → attach).
import { login, api, cmd, get, check, summary } from './lib.mjs'
const BASE = 'http://localhost:8080/api/v1'
const j = o => JSON.stringify(o)

const info = (await get('/dev/seed-info')).data
const ops = await login('ops@dev.local')

console.log('── S14 Submit Invoice (create listing + BC16 doc flow) ──')

// 1. create the listing — originates the deal_invoice
const invNo = `INV-S14-${(process.hrtime.bigint() % 100000000n)}`
const create = await cmd('/listings', { bearer: ops, body: {
  supplier_id: info.supplier_id, buyer_id: info.buyer_id,
  invoice_number: invNo, face_value_paise: 5000000, invoice_date: '2026-06-01', tenor_days: 45 } })
check('create listing (POST /listings) 201', create.status === 201, `${create.status} ${create.data?.error_code ?? ''}`)
const listingId = create.data?.aggregate_id
const l = await get(`/listings/${listingId}`, ops)
check('listing created (status draft)', l.data?.status === 'draft', l.data?.status)  // deal_invoice is 'submitted'; listing starts 'draft' → ops-checks

// 2. BC16 document flow: initiate → upload → finalize → attach
const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF')
const init = await cmd('/documents', { bearer: ops, body: { kind: 'invoice', content_type: 'application/pdf', declared_size: pdf.length } })
check('document initiate 200', init.ok, `${init.status}`)
const docId = init.data?.document_id ?? init.data?.aggregate_id
const put = await fetch(`${BASE}/documents/${docId}/content`, { method: 'PUT', headers: { Authorization: `Bearer ${ops}`, 'Content-Type': 'application/pdf' }, body: pdf })
check('document upload (PUT content)', put.ok, `${put.status}`)
const fin = await cmd(`/documents/${docId}/finalize`, { bearer: ops })
check('document finalize', fin.ok, `${fin.status}`)
const attach = await cmd(`/listings/${listingId}/invoice-documents`, { bearer: ops, body: { document_id: docId } })
check('attach invoice-document', attach.ok, `${attach.status} ${attach.data?.error_code ?? ''}`)

// 3. verify: doc is linked + the listing shows in the supplier's tracker (BE-11, what S14 reads)
const docs = await get(`/listings/${listingId}/invoice-documents`, ops)
check('invoice-document linked', Array.isArray(docs.data) && docs.data.some(d => d.document_id === docId), j(docs.data))
const tracker = await get(`/suppliers/${info.supplier_id}/listings`, ops)
check('listing appears in supplier tracker', tracker.data?.some(r => r.listing_id === listingId || r.invoice_number === invNo), `count=${tracker.data?.length}`)

process.exit(summary() ? 0 : 1)
