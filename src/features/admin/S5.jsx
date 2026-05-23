import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePersona } from '../../context/PersonaContext.jsx'
import MfaModal from '../../components/MfaModal.jsx'
import Button from '../../components/kit/Button.jsx'
import Card from '../../components/kit/Card.jsx'
import FormField from '../../components/kit/FormField.jsx'
import PageHeader from '../../components/kit/PageHeader.jsx'
import StatusBadge from '../../components/kit/StatusBadge.jsx'
import Table from '../../components/kit/Table.jsx'
import { formatPaise, formatDate, formatDatetime } from '../../utils/format.js'
import mockData from '../../data/mockData.js'

const CHECK_LABELS = {
  irn_verified: 'IRN Verified (INV.5)', eway_bill_match: 'E-Way Bill Match',
  buyer_supplier_rel: 'Buyer-Supplier Relationship', duplicate_check: 'Duplicate Check',
  exposure_cap: 'Exposure Cap', buyer_limit: 'Buyer Limit / Headroom',
  doc_completeness: 'Document Completeness', buyer_ack: 'Buyer Acknowledgment (DL-019)',
}
const OUTCOME_COLOR = { pass: 'green', fail: 'red', pending: 'amber' }

export default function S5() {
  const navigate = useNavigate()
  const { currentPersona } = usePersona()
  const [tab, setTab]             = useState('checks')
  const [selectedInv, setSelectedInv] = useState(null)
  const [checkOutcomes, setCheckOutcomes] = useState(
    Object.fromEntries(mockData.S5.invoices.map(inv => [inv.invoice_id, { ...inv.check_outcomes }]))
  )
  const [showMfa, setShowMfa]     = useState(false)
  const [listings, setListings]   = useState(mockData.S5.listings_for_approval)

  // Maker-checker: ops-treasury persona is the maker
  const isMaker = currentPersona.id === 'ops-treasury'
  const isTreasury = currentPersona.id === 'treasury-settlement' || currentPersona.id === 'ops-treasury'

  function recordOutcome(invId, checkKey, outcome) {
    setCheckOutcomes(prev => ({
      ...prev,
      [invId]: {
        ...prev[invId],
        [checkKey]: { ...prev[invId][checkKey], outcome, checked_at: new Date().toISOString() },
      },
    }))
  }

  function handleGoLive() {
    setShowMfa(true)
  }

  function onMfaConfirm() {
    setShowMfa(false)
    setListings(prev => prev.map(l => ({ ...l, status: 'live' })))
    navigate('/s6')
  }

  const invColumns = [
    { key: 'invoice_number', label: 'Invoice #' },
    { key: 'supplier_name',  label: 'Supplier' },
    { key: 'buyer_name',     label: 'Buyer' },
    { key: 'face_value',     label: 'Face Value', render: row => formatPaise(row.face_value) },
    { key: 'tenor_days',     label: 'Tenor',      render: row => `${row.tenor_days}d` },
    { key: 'status',         label: 'Status',     render: row => <StatusBadge label={row.status.replace(/_/g, ' ')} color="amber" /> },
    { key: 'action',         label: '',           render: row => <Button variant="ghost" className="text-xs py-1 px-3" onClick={() => setSelectedInv(row)}>Open →</Button> },
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
      {showMfa && <MfaModal action="Approve Listing Go-Live" onConfirm={onMfaConfirm} onCancel={() => setShowMfa(false)} />}
      <PageHeader title="Invoice Checks + Listing Approval" subtitle="Ops Executive (checks) · Treasury & Settlement (go-live approval)" />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-5">
        {[['checks', 'Invoice Checks'], ['approval', 'Listing Approval (Maker-Checker)']].map(([id, label]) => (
          <button key={id} onClick={() => { setTab(id); setSelectedInv(null) }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Invoice Checks ── */}
      {tab === 'checks' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className={selectedInv ? 'lg:col-span-2' : 'lg:col-span-5'}>
            <Table columns={invColumns} rows={mockData.S5.invoices} />
          </div>

          {selectedInv && (
            <div className="lg:col-span-3 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">{selectedInv.invoice_number}</h2>
                <button className="text-xs text-gray-400 hover:text-gray-700" onClick={() => setSelectedInv(null)}>✕</button>
              </div>
              <Card>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mb-3">
                  <div><p className="text-xs text-gray-400">Face Value</p><p className="font-semibold">{formatPaise(selectedInv.face_value)}</p></div>
                  <div><p className="text-xs text-gray-400">Tenor</p><p className="font-semibold">{selectedInv.tenor_days}d</p></div>
                  <div><p className="text-xs text-gray-400">IRN (GST Verified)</p><p className="font-mono text-xs">{selectedInv.irn.slice(0, 20)}…</p></div>
                  <div><p className="text-xs text-gray-400">Due Date</p><p className="font-semibold">{formatDate(selectedInv.due_date)}</p></div>
                </div>
              </Card>

              <div className="space-y-2">
                {Object.entries(checkOutcomes[selectedInv.invoice_id]).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex-1">
                      <p className="text-xs font-medium text-gray-700">{CHECK_LABELS[key] ?? key}</p>
                      <p className="text-xs text-gray-400">{val.detail}</p>
                    </div>
                    <StatusBadge label={val.outcome} color={OUTCOME_COLOR[val.outcome] ?? 'gray'} />
                    {val.outcome === 'pending' && (
                      <div className="flex gap-1 ml-2">
                        <Button className="text-xs py-0.5 px-2" onClick={() => recordOutcome(selectedInv.invoice_id, key, 'pass')}>Pass</Button>
                        <Button variant="ghost" className="text-xs py-0.5 px-2 text-red-600" onClick={() => recordOutcome(selectedInv.invoice_id, key, 'fail')}>Fail</Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => recordOutcome(selectedInv.invoice_id, 'buyer_ack', 'pending')}>Send Ack Request</Button>
                <Button variant="ghost" onClick={() => recordOutcome(selectedInv.invoice_id, 'buyer_ack', 'pass')}>Capture Manual Ack</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Listing Approval ── */}
      {tab === 'approval' && (
        <div>
          <Table columns={listColumns} rows={listings} />

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
                  {lst.status === 'live' ? (
                    <StatusBadge label="Live ✓" color="green" />
                  ) : (
                    <>
                      {isMaker && (
                        <p className="text-xs text-red-600 font-medium">⛔ Maker-checker violation: you cannot approve your own listing (C4).</p>
                      )}
                      <Button
                        disabled={isMaker || !isTreasury}
                        onClick={handleGoLive}
                        title={isMaker ? 'Cannot approve as maker' : !isTreasury ? 'Treasury & Settlement role required' : ''}
                      >
                        Approve Go-Live (C7 — MFA required)
                      </Button>
                      {!isTreasury && !isMaker && <p className="text-xs text-gray-400">Switch to Treasury & Settlement persona to approve.</p>}
                    </>
                  )}
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
