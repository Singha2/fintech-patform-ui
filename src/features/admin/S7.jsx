import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/kit/Button.jsx'
import Card from '../../components/kit/Card.jsx'
import PageHeader from '../../components/kit/PageHeader.jsx'
import StatusBadge from '../../components/kit/StatusBadge.jsx'
import Table from '../../components/kit/Table.jsx'
import { formatPaise, formatDate, formatDatetime } from '../../utils/format.js'
import mockData from '../../data/mockData.js'
import { settlement as settlementSvc, distributionTax as distributionTaxSvc } from '../../api/services/index.js'
import { describe } from '../../api/errors.js'
import { useStore } from '../../store/PlatformStore.jsx'

const REC_COLOR = { matched: 'green', partial: 'amber', unmatched: 'red' }

export default function S7() {
  const navigate = useNavigate()
  // Store-driven (P4): distributions drafted on disbursement (S6); maturity + execution close the deal and land
  // the payout on the investor's S13 portfolio (G-E4). Reconciliation stays local (G6 — no read endpoint).
  const { distributionsList } = useStore()
  const [tab, setTab]       = useState('distributions')
  const [selectedId, setSelectedId] = useState(null)
  const [recon, setRecon] = useState(mockData.S7.reconciliation)
  const [busy, setBusy]   = useState(false)
  const [err, setErr]     = useState('')

  const distributions = distributionsList()

  function raiseShortfall(recId) {
    setRecon(prev => prev.map(r => (r.rec_id === recId ? { ...r, status: 'shortfall_raised' } : r)))
  }

  // 🔗 POST /listings/{id}/record-maturity {amount_paise, utr} (TREASURY).
  async function recordMaturity(listingId, amountPaise) {
    setErr(''); setBusy(true)
    try { await settlementSvc.recordMaturity(listingId, { amount_paise: amountPaise, utr: `UTR${Date.now()}` }) }
    catch (e) { setErr(describe(e)) } finally { setBusy(false) }
  }
  // 🔗 distribution/draft (maker) → distribution/approve (checker ≠ maker). Needs TWO treasury users — a same-user
  // approve is rejected (checker = maker), so a full run means re-logging as the second treasury account.
  async function executeDistribution(listingId) {
    setErr(''); setBusy(true)
    try {
      await distributionTaxSvc.distributionDraft(listingId)
      await distributionTaxSvc.distributionApprove(listingId)
    } catch (e) { setErr(describe(e)) } finally { setBusy(false) }
  }

  const distColumns = [
    { key: 'listing_id',   label: 'Listing' },
    { key: 'buyer_name',   label: 'Buyer' },
    { key: 'maturity_date', label: 'Maturity', render: row => formatDate(row.maturity_date) },
    { key: 'buyer_payment_ref', label: 'Payment Ref' },
    { key: 'status',       label: 'Status', render: row => <StatusBadge label={row.status.replace(/_/g, ' ')} color={row.status === 'executed' ? 'green' : 'amber'} /> },
    { key: 'action',       label: '',       render: row => <Button variant="ghost" className="text-xs py-1 px-3" onClick={() => setSelectedId(row.distribution_id)}>Open →</Button> },
  ]

  const recColumns = [
    { key: 'listing_id',     label: 'Listing' },
    { key: 'buyer_name',     label: 'Buyer' },
    { key: 'expected_paise', label: 'Expected (₹)', render: row => formatPaise(row.expected_paise) },
    { key: 'actual_paise',   label: 'Actual (₹)',   render: row => formatPaise(row.actual_paise) },
    { key: 'status',         label: 'Status',       render: row => <StatusBadge label={row.status} color={REC_COLOR[row.status] ?? 'gray'} /> },
    { key: 'reconciled_at',  label: 'Reconciled',   render: row => formatDatetime(row.reconciled_at) },
    { key: 'txn_ref',        label: 'Txn Ref' },
    { key: 'action',         label: '',             render: row => row.status !== 'matched'
        ? <Button variant="ghost" className="text-xs py-1 px-3 text-amber-700" disabled={row.status === 'shortfall_raised'} onClick={() => raiseShortfall(row.rec_id)}>{row.status === 'shortfall_raised' ? 'Shortfall Raised ✓' : 'Raise Shortfall'}</Button>
        : null
    },
  ]

  const selDist = selectedId
    ? distributions.find(d => d.distribution_id === selectedId) ?? null
    : null

  return (
    <div>
      <PageHeader title="Distribution + Reconciliation" subtitle="Treasury & Settlement — maturity payouts and buyer payment matching" />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-5">
        {[['distributions', 'Distributions'], ['reconciliation', 'Reconciliation']].map(([id, label]) => (
          <button key={id} onClick={() => { setTab(id); setSelectedId(null) }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Distributions ── */}
      {tab === 'distributions' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className={selDist ? 'lg:col-span-2' : 'lg:col-span-5'}>
            <Table columns={distColumns} rows={distributions} />
          </div>

          {selDist && (
            <div className="lg:col-span-3 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">{selDist.buyer_name} — {selDist.listing_id}</h2>
                <button className="text-xs text-gray-400 hover:text-gray-700" onClick={() => setSelectedId(null)}>✕</button>
              </div>

              <Card title="Buyer Payment">
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div><p className="text-xs text-gray-400">Amount Received</p><p className="font-semibold">{formatPaise(selDist.buyer_payment_amount_paise)}</p></div>
                  <div><p className="text-xs text-gray-400">Txn Ref</p><p className="font-mono text-xs">{selDist.buyer_payment_ref}</p></div>
                  <div><p className="text-xs text-gray-400">Maturity Date</p><p>{formatDate(selDist.maturity_date)}</p></div>
                </div>
              </Card>

              <Card title="Per-Investor Payouts (DL-045 / G4: gross − tds − fee = net)">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs divide-y divide-gray-100">
                    <thead className="bg-gray-50">
                      <tr>{['Investor', 'Principal', 'Gross', 'TDS', 'Fee', 'Net', 'UTR'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {selDist.investors.map((inv, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium text-gray-800">{inv.investor_name}</td>
                          <td className="px-3 py-2">{formatPaise(inv.amount_paise)}</td>
                          <td className="px-3 py-2">{formatPaise(inv.gross_paise)}</td>
                          <td className="px-3 py-2 text-red-600">−{formatPaise(inv.tds_paise)}</td>
                          <td className="px-3 py-2 text-red-600">−{formatPaise(inv.fee_paise)}</td>
                          <td className="px-3 py-2 font-semibold text-green-700">{formatPaise(inv.net_paise)}</td>
                          <td className="px-3 py-2 font-mono text-gray-500">{inv.utr ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {selDist.status === 'executed' ? (
                  <div className="mt-4 flex items-center gap-2"><StatusBadge label="All Distributions Executed" color="green" /></div>
                ) : !selDist.matured ? (
                  <div className="mt-4">
                    <Button disabled={busy} onClick={() => recordMaturity(selDist.listing_id, selDist.buyer_payment_amount_paise)}>{busy ? 'Recording…' : 'Record Maturity (buyer repayment)'}</Button>
                    <p className="text-xs text-gray-400 mt-2">C23: buyer repayment must be recorded before distribution executes.</p>
                  </div>
                ) : (
                  <Button className="mt-4" disabled={busy} onClick={() => executeDistribution(selDist.listing_id)}>
                    {busy ? 'Executing…' : 'Execute Distributions (T+1 · DL-030)'}
                  </Button>
                )}
                {err && <p className="text-xs text-red-600 mt-3">Failed: {err}</p>}
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ── Reconciliation ── */}
      {tab === 'reconciliation' && (
        <div>
          <p className="text-xs text-gray-400 mb-3">G6: Last reconciled — {formatDatetime('2026-05-18T11:00:00Z')} · C23: Actual inflow must match before distribution executes.</p>
          <Table columns={recColumns} rows={recon} />
          {/* TBD: Shortfall collections escalation (BC6) — separate sub-tab or queue? */}
        </div>
      )}

      <Button variant="ghost" className="mt-6 text-sm" onClick={() => navigate('/s2')}>← Back to Dashboard</Button>
      <p className="text-xs text-gray-400 mt-2">Rules: DL-030 (T+1) · DL-045/G4 (gross−tds−fee=net) · C23 (actual must match) · G6 (EoD reconciliation)</p>
    </div>
  )
}
