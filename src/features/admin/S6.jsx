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
import { useStore } from '../../store/PlatformStore.jsx'

// cash_payout_status: drafted|approved|sent|executed|partial|failed|completed
const STATUS_COLOR = { drafted: 'amber', approved: 'amber', sent: 'amber', executed: 'green', partial: 'amber', failed: 'red', completed: 'green' }

export default function S6() {
  const navigate = useNavigate()
  const { currentPersona } = usePersona()
  // Store-driven (P4): a fully-funded listing's disbursement is drafted at S12 commit and surfaces here (G-E1).
  const { disbursementQueue, approveDisbursement } = useStore()
  const [selectedId, setSelectedId] = useState(null)
  const [showMfa, setShowMfa]   = useState(false)

  const disbursements = disbursementQueue()
  const isMaker    = currentPersona.id === 'ops-treasury'
  const isTreasury = currentPersona.id === 'treasury-settlement' || currentPersona.id === 'ops-treasury'

  function handleApprove() { setShowMfa(true) }

  function onMfaConfirm() {
    setShowMfa(false)
    if (sel) approveDisbursement(sel.listing_id)  // 🔗 POST /listings/{id}/disbursement/approve
    navigate('/s7')
  }

  const columns = [
    { key: 'supplier_name',    label: 'Supplier' },
    { key: 'buyer_name',       label: 'Buyer' },
    { key: 'net_amount_paise', label: 'Net Amount (DL-030)', render: row => formatPaise(row.net_amount_paise) },
    { key: 'due_disbursement_date', label: 'Due Date (T+1)',  render: row => formatDate(row.due_disbursement_date) },
    { key: 'all_signed',       label: 'All Signed (C27)',    render: row => <StatusBadge label={row.all_signed ? '✓ Yes' : '✗ No'} color={row.all_signed ? 'green' : 'red'} /> },
    { key: 'status',           label: 'Status',             render: row => <StatusBadge label={row.status.replace(/_/g, ' ')} color={STATUS_COLOR[row.status] ?? 'gray'} /> },
    { key: 'action',           label: '',                   render: row => <Button variant="ghost" className="text-xs py-1 px-3" onClick={() => setSelectedId(row.disbursement_id)}>Open →</Button> },
  ]

  const sel = selectedId ? disbursements.find(d => d.disbursement_id === selectedId) ?? null : null

  return (
    <div>
      {showMfa && <MfaModal action="Approve Disbursement" onConfirm={onMfaConfirm} onCancel={() => setShowMfa(false)} />}
      <PageHeader title="Disbursement Approval Queue" subtitle="Treasury & Settlement — approve fund release to supplier" />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className={sel ? 'lg:col-span-2' : 'lg:col-span-5'}>
          <Table columns={columns} rows={disbursements} />
        </div>

        {sel && (
          <div className="lg:col-span-3 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">{sel.supplier_name}</h2>
              <button className="text-xs text-gray-400 hover:text-gray-700" onClick={() => setSelectedId(null)}>✕</button>
            </div>

            <Card title="Disbursement Detail">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div><p className="text-xs text-gray-400">Listing</p><p className="font-medium">{sel.listing_id}</p></div>
                <div><p className="text-xs text-gray-400">Buyer</p><p className="font-medium">{sel.buyer_name}</p></div>
                <div><p className="text-xs text-gray-400">Net Amount</p><p className="font-semibold text-gray-900">{formatPaise(sel.net_amount_paise)}</p></div>
                <div><p className="text-xs text-gray-400">Due Date (T+1 · DL-030)</p><p className="font-semibold">{formatDate(sel.due_disbursement_date)}</p></div>
                <div><p className="text-xs text-gray-400">Funding Completed</p><p className="text-gray-700">{formatDate(sel.funding_completed_at)}</p></div>
                <div><p className="text-xs text-gray-400">Maker</p><p className="text-gray-700">{sel.maker_name}</p></div>
                <div>
                  <p className="text-xs text-gray-400">All Assignments Signed (C27)</p>
                  <StatusBadge label={sel.all_signed ? '✓ All signed' : '✗ Pending signatures'} color={sel.all_signed ? 'green' : 'red'} />
                </div>
                {sel.utr && <div><p className="text-xs text-gray-400">UTR</p><p className="font-mono text-sm text-green-700">{sel.utr}</p></div>}
              </div>
            </Card>

            {sel.status === 'executed' ? (
              <Card><div className="flex items-center gap-2"><StatusBadge label="Executed" color="green" /><span className="text-sm text-gray-600">Disbursement complete. UTR: <span className="font-mono">{sel.utr}</span></span></div></Card>
            ) : (
              <Card title="Checker Action">
                {!sel.all_signed && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                    Awaiting investor e-signatures — disbursement gated until all_signed = true (C27/L.5).
                  </p>
                )}
                {isMaker && (
                  <p className="text-xs text-red-600 mb-3">⛔ Maker-checker violation: you cannot approve your own disbursement (C4).</p>
                )}
                <Button
                  onClick={handleApprove}
                  disabled={!sel.all_signed || isMaker || !isTreasury}
                >
                  Approve Disbursement (MFA required — C7)
                </Button>
                {!isTreasury && !isMaker && <p className="text-xs text-gray-400 mt-2">Switch to Treasury & Settlement persona to approve.</p>}
                <p className="text-xs text-gray-400 mt-2">VA reference: {sel.listing_id} · DL-043 (per-listing VA)</p>
              </Card>
            )}
          </div>
        )}
      </div>

      <Button variant="ghost" className="mt-6 text-sm" onClick={() => navigate('/s2')}>← Back to Dashboard</Button>
      <p className="text-xs text-gray-400 mt-2">Rules: DL-030 (T+1) · C27/L.5 (all_signed gate) · C4/C7 (maker-checker + MFA) · DL-043 (per-listing VA)</p>
    </div>
  )
}
