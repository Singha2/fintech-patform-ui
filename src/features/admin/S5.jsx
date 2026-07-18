import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePersona } from '../../context/PersonaContext.jsx'
import MfaModal from '../../components/MfaModal.jsx'
import Button from '../../components/kit/Button.jsx'
import Card from '../../components/kit/Card.jsx'
import PageHeader from '../../components/kit/PageHeader.jsx'
import StatusBadge from '../../components/kit/StatusBadge.jsx'
import Table from '../../components/kit/Table.jsx'
import { formatPaise, formatDate } from '../../utils/format.js'
import { listings as listingsSvc, documents as documentsSvc } from '../../api/services/index.js'
import { describe } from '../../api/errors.js'
import { useStore } from '../../store/PlatformStore.jsx'
import { useHydrate } from '../../store/useHydrate.js'
import { DEFAULT_CHECKS } from '../../store/operations.js'

// Keys are the canonical ops-check `check_name` wire values (POST /listings/{id}/record-ops-check).
// buyer_ack is a separate command (record-buyer-ack), grouped here for the UI only.
const CHECK_LABELS = {
  irn_validity: 'IRN Verified (INV.5)', eway_bill_match: 'E-Way Bill Match',
  buyer_supplier_relationship: 'Buyer-Supplier Relationship', duplicate_check: 'Duplicate Check',
  supplier_exposure_cap: 'Exposure Cap', buyer_limit_headroom: 'Buyer Limit / Headroom',
  document_completeness: 'Document Completeness', buyer_ack: 'Buyer Acknowledgment (DL-019)',
}
const OUTCOME_COLOR = { pass: 'green', fail: 'red', pending: 'amber' }

export default function S5() {
  const navigate = useNavigate()
  const { currentPersona } = usePersona()
  // Store-driven (P3): invoices flow in from S14, listings created here surface on S11 → S12.
  const { opsInvoices, getInvoice, listListings } = useStore()
  const [tab, setTab]             = useState('checks')
  const [selectedId, setSelectedId] = useState(null)
  const [showMfa, setShowMfa]     = useState(false)
  const [pendingListingId, setPendingListingId] = useState(null)
  const [busy, setBusy]           = useState(false)
  const [err, setErr]             = useState('')
  const [attachedDoc, setAttachedDoc] = useState({})   // { [listingId]: document_id } — invoice PDFs attached this session

  // Live: GET /listings → the ops queue (invoices) + approval list (listings) (BE-6); + the selected invoice's
  // ops-checks on open (two-level fetch). No-op in mock mode.
  const live = useHydrate('opsListings')
  const checkLive = useHydrate(['opsChecks', selectedId], [selectedId])

  // Record one ops-check — a direct backend command (the mock "invoice" IS the backend listing). Ensures
  // ops-checks are started (draft → operational_checks_in_progress), threads the version, then refreshes the
  // check grid + the list. buyer_ack is a separate command (record-buyer-ack).
  async function recordCheck(listingId, checkName, uiOutcome) {
    setErr(''); setBusy(true)
    try {
      let cur = await listingsSvc.get(listingId)
      if (cur.status === 'draft') { await listingsSvc.startOpsChecks(listingId, cur.aggregate_version); cur = await listingsSvc.get(listingId) }
      if (checkName === 'buyer_ack') {
        await listingsSvc.recordBuyerAck(listingId, { outcome: uiOutcome === 'fail' ? 'declined' : 'acknowledged' }, cur.aggregate_version)
      } else {
        await listingsSvc.recordOpsCheck(listingId, { check_name: checkName, outcome: uiOutcome === 'fail' ? 'failed' : 'passed' }, cur.aggregate_version)
      }
      await checkLive.reload(); await live.reload()
    } catch (e) { setErr(describe(e)) } finally { setBusy(false) }
  }
  async function sendAckRequest(listingId) {
    setErr(''); setBusy(true)
    try {
      const cur = await listingsSvc.get(listingId)
      await listingsSvc.requestBuyerAck(listingId, { sla_hours: 48 }, cur.aggregate_version)
      await checkLive.reload()
    } catch (e) { setErr(describe(e)) } finally { setBusy(false) }
  }

  // Upload + attach the invoice PDF (BC16 two-phase): initiate → PUT bytes → finalize → attach to the listing.
  // Gates `document_completeness`; DOC.3 then requires a *second* Ops user to record that check (recorder ≠ uploader).
  async function uploadInvoiceDoc(listingId, file) {
    setErr(''); setBusy(true)
    try {
      const blob = new Blob([await file.arrayBuffer()], { type: 'application/pdf' })
      const init = await documentsSvc.initiate({ kind: 'invoice', content_type: 'application/pdf', declared_size: blob.size })
      const docId = init?.document_id ?? init?.aggregate_id
      await documentsSvc.uploadContent(docId, blob, 'application/pdf')
      await documentsSvc.finalize(docId)
      await listingsSvc.attachInvoiceDoc(listingId, { document_id: docId })
      setAttachedDoc(prev => ({ ...prev, [listingId]: docId }))
      await checkLive.reload()
    } catch (e) { setErr(describe(e)) } finally { setBusy(false) }
  }

  // Maker-checker: ops-treasury persona is the maker
  const isMaker = currentPersona.id === 'ops-treasury'
  const isTreasury = currentPersona.id === 'treasury-settlement' || currentPersona.id === 'ops-treasury'

  const invoices = opsInvoices()
  const listings = listListings('ready_for_review')
  const selectedInv = selectedId ? getInvoice(selectedId) : null

  const checksFor = (invId) => getInvoice(invId)?.check_outcomes ?? DEFAULT_CHECKS
  function allChecksPassed(invId) {
    const vals = Object.values(checksFor(invId))
    return vals.length > 0 && vals.every(o => o.outcome === 'pass')
  }

  // Promote a fully-checked invoice into the approval list — the backend sequence to ready_for_review:
  // complete-ops-checks → (request + record buyer-ack) → snapshot-and-ready {rate_bps}. All OPS, version threaded.
  const VERS = async (id) => (await listingsSvc.get(id)).aggregate_version
  async function promoteToListing(inv) {
    const listingId = inv.invoice_id
    setErr(''); setBusy(true)
    try {
      await listingsSvc.completeOpsChecks(listingId, await VERS(listingId))
      await listingsSvc.requestBuyerAck(listingId, { sla_hours: 48 }, await VERS(listingId))
      await listingsSvc.recordBuyerAck(listingId, { outcome: 'acknowledged' }, await VERS(listingId))
      await listingsSvc.snapshotAndReady(listingId, { rate_bps: 1200 }, await VERS(listingId))
      await live.reload()
      setSelectedId(null); setTab('approval')
    } catch (e) { setErr(describe(e)) } finally { setBusy(false) }
  }

  function handleGoLive(listingId) {
    setErr(''); setPendingListingId(listingId); setShowMfa(true)
  }

  // Go-live approval — TREASURY, checker ≠ the maker who ran snapshot-and-ready. 🔗 approve-go-live → live (S11).
  async function onMfaConfirm() {
    setShowMfa(false)
    const listingId = pendingListingId
    setPendingListingId(null)
    if (!listingId) return
    setBusy(true); setErr('')
    try {
      await listingsSvc.approveGoLive(listingId, await VERS(listingId))
      await live.reload()
      navigate('/s6')
    } catch (e) { setErr(describe(e)) } finally { setBusy(false) }
  }

  const invColumns = [
    { key: 'invoice_number', label: 'Invoice #' },
    { key: 'supplier_name',  label: 'Supplier' },
    { key: 'buyer_name',     label: 'Buyer' },
    { key: 'face_value',     label: 'Face Value', render: row => formatPaise(row.face_value) },
    { key: 'tenor_days',     label: 'Tenor',      render: row => `${row.tenor_days}d` },
    { key: 'status',         label: 'Status',     render: row => <StatusBadge label={row.status.replace(/_/g, ' ')} color="amber" /> },
    { key: 'action',         label: '',           render: row => <Button variant="ghost" className="text-xs py-1 px-3" onClick={() => setSelectedId(row.invoice_id)}>Open →</Button> },
  ]

  const listColumns = [
    { key: 'listing_id',     label: 'Listing ID' },
    { key: 'supplier_name',  label: 'Supplier' },
    { key: 'buyer_name',     label: 'Buyer' },
    { key: 'funding_target', label: 'Target',  render: row => formatPaise(row.funding_target) },
    { key: 'rate_bps',       label: 'Rate',    render: row => `${(row.rate_bps / 100).toFixed(2)}%` },
    { key: 'maker_name',     label: 'Maker (C4)' },
    { key: 'status',         label: 'Status',  render: row => <StatusBadge label={row.status.replace(/_/g, ' ')} color={row.status === 'live' ? 'green' : 'amber'} /> },
  ]

  return (
    <div>
      {showMfa && <MfaModal action="Approve Listing Go-Live" onConfirm={onMfaConfirm} onCancel={() => { setShowMfa(false); setPendingListingId(null) }} />}
      <PageHeader title="Invoice Checks + Listing Approval" subtitle="Ops Executive (checks) · Treasury & Settlement (go-live approval)" />
      {live.error && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">Live load failed: {live.error}</div>}
      {live.loading && <p className="text-xs text-gray-400 mb-3">Loading invoices…</p>}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-5">
        {[['checks', 'Invoice Checks'], ['approval', 'Listing Approval (Maker-Checker)']].map(([id, label]) => (
          <button key={id} onClick={() => { setTab(id); setSelectedId(null) }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Invoice Checks ── */}
      {tab === 'checks' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className={selectedInv ? 'lg:col-span-2' : 'lg:col-span-5'}>
            {invoices.length === 0
              ? <Card><p className="text-sm text-gray-500 py-6 text-center">No invoices awaiting checks. Submit one from the Supplier Portal (S14).</p></Card>
              : <Table columns={invColumns} rows={invoices} />}
          </div>

          {selectedInv && (
            <div className="lg:col-span-3 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">{selectedInv.invoice_number}</h2>
                <button className="text-xs text-gray-400 hover:text-gray-700" onClick={() => setSelectedId(null)}>✕</button>
              </div>
              <Card>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mb-3">
                  <div><p className="text-xs text-gray-400">Face Value</p><p className="font-semibold">{formatPaise(selectedInv.face_value)}</p></div>
                  <div><p className="text-xs text-gray-400">Tenor</p><p className="font-semibold">{selectedInv.tenor_days}d</p></div>
                  <div><p className="text-xs text-gray-400">IRN (GST Verified)</p><p className="font-mono text-xs">{selectedInv.irn ? `${selectedInv.irn.slice(0, 20)}…` : '—'}</p></div>
                  <div><p className="text-xs text-gray-400">Due Date</p><p className="font-semibold">{formatDate(selectedInv.due_date)}</p></div>
                </div>
                <div className="pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-400 mb-1.5">Invoice PDF <span className="text-gray-300">· BC16 — required for Document Completeness</span></p>
                  {attachedDoc[selectedInv.invoice_id] ? (
                    <p className="text-xs text-green-700">✓ Attached ({attachedDoc[selectedInv.invoice_id].slice(0, 8)}…) — record <span className="font-medium">Document Completeness</span> as a second Ops user (DOC.3, recorder ≠ uploader).</p>
                  ) : (
                    <label className="inline-flex items-center gap-2 text-xs text-indigo-700 cursor-pointer hover:text-indigo-900">
                      <span className="px-3 py-1 rounded-md border border-indigo-200 bg-indigo-50">{busy ? 'Uploading…' : 'Upload Invoice PDF'}</span>
                      <input type="file" accept="application/pdf" className="hidden" disabled={busy}
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadInvoiceDoc(selectedInv.invoice_id, f); e.target.value = '' }} />
                    </label>
                  )}
                </div>
              </Card>

              <div className="space-y-2">
                {Object.entries(checksFor(selectedInv.invoice_id)).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex-1">
                      <p className="text-xs font-medium text-gray-700">{CHECK_LABELS[key] ?? key}</p>
                      <p className="text-xs text-gray-400">{val.detail}</p>
                    </div>
                    <StatusBadge label={val.outcome} color={OUTCOME_COLOR[val.outcome] ?? 'gray'} />
                    {val.outcome === 'pending' && (
                      <div className="flex gap-1 ml-2">
                        <Button className="text-xs py-0.5 px-2" disabled={busy} onClick={() => recordCheck(selectedInv.invoice_id, key, 'pass')}>Pass</Button>
                        <Button variant="ghost" className="text-xs py-0.5 px-2 text-red-600" disabled={busy} onClick={() => recordCheck(selectedInv.invoice_id, key, 'fail')}>Fail</Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {err && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">Check failed: {err}</div>}

              <div className="flex gap-3">
                <Button variant="ghost" disabled={busy} onClick={() => sendAckRequest(selectedInv.invoice_id)}>Send Ack Request</Button>
                <Button variant="ghost" disabled={busy} onClick={() => recordCheck(selectedInv.invoice_id, 'buyer_ack', 'pass')}>Capture Manual Ack</Button>
              </div>
              <Button disabled={busy || !allChecksPassed(selectedInv.invoice_id)} onClick={() => promoteToListing(selectedInv)}>
                {busy ? 'Promoting…' : 'Send to Listing Approval →'}
              </Button>
              {!allChecksPassed(selectedInv.invoice_id) && <p className="text-xs text-gray-400">All checks must pass before the listing can be priced and sent for go-live approval.</p>}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Listing Approval ── */}
      {tab === 'approval' && (
        <div>
          {err && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">Failed: {err}</div>}
          {listings.length === 0
            ? <Card><p className="text-sm text-gray-500 py-6 text-center">No listings awaiting go-live. Pass all checks on an invoice and send it here.</p></Card>
            : <Table columns={listColumns} rows={listings} />}

          {listings.map(lst => (
            <Card key={lst.listing_id} className="mt-4">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <p className="font-semibold text-gray-900">{lst.listing_id} — {lst.buyer_name}</p>
                  <p className="text-sm text-gray-500">Maker: <span className="font-medium text-gray-700">{lst.maker_name}</span> (C4 — cannot be same as approver)</p>
                  <p className="text-sm text-gray-500 mt-1">Funding target: {formatPaise(lst.funding_target)} · Rate: {(lst.rate_bps / 100).toFixed(2)}% p.a. · Tenor: {lst.tenor_days}d</p>
                  <p className="text-xs text-gray-400 mt-1">Pricing snapshot is immutable post-approval (G20).</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {isMaker && (
                    <p className="text-xs text-red-600 font-medium">⛔ Maker-checker violation: you cannot approve your own listing (C4).</p>
                  )}
                  <Button
                    disabled={busy || isMaker || !isTreasury}
                    onClick={() => handleGoLive(lst.listing_id)}
                    title={isMaker ? 'Cannot approve as maker' : !isTreasury ? 'Treasury & Settlement role required' : ''}
                  >
                    {busy ? 'Approving…' : 'Approve Go-Live (C7 — MFA required)'}
                  </Button>
                  {!isTreasury && !isMaker && <p className="text-xs text-gray-400">Switch to Treasury & Settlement persona to approve.</p>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Button variant="ghost" className="mt-6 text-sm" onClick={() => navigate('/s2')}>← Back to Dashboard</Button>
      <p className="text-xs text-gray-400 mt-2">Rules: DL-027 (Ops owns checks) · DL-019 (per-invoice ack) · C4 (maker≠checker) · C7 (MFA for go-live) · INV.5 (GST verified)</p>
    </div>
  )
}
