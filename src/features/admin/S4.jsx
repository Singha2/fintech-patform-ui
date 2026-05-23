import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/kit/Button.jsx'
import Card from '../../components/kit/Card.jsx'
import FormField from '../../components/kit/FormField.jsx'
import PageHeader from '../../components/kit/PageHeader.jsx'
import StatusBadge from '../../components/kit/StatusBadge.jsx'
import Table from '../../components/kit/Table.jsx'
import { formatPaise, formatDate } from '../../utils/format.js'
import mockData from '../../data/mockData.js'

const STATUS_COLOR = { nominated: 'gray', identity_verified: 'amber', under_credit_review: 'amber', approved_with_limit: 'amber', active: 'green', suspended: 'red' }

const STAGE_ACTIONS = {
  nominated:            { label: 'Trigger Identity Verification', next: 'identity_verified' },
  identity_verified:    { label: 'Start Credit Assessment',       next: 'under_credit_review' },
  under_credit_review:  { label: 'Approve Credit',               next: 'approved_with_limit' },
  approved_with_limit:  { label: 'Mark Active',                  next: 'active' },
  active:               null,
}

export default function S4() {
  const navigate = useNavigate()
  const [selected, setSelected]     = useState(null)
  const [fourEyes, setFourEyes]     = useState(false)
  const [buyerStatuses, setBuyerStatuses] = useState(
    Object.fromEntries(mockData.S4.buyers.map(b => [b.buyer_id, b.status]))
  )
  const [approver, setApprover] = useState('')

  const buyers = mockData.S4.buyers.map(b => ({ ...b, status: buyerStatuses[b.buyer_id] }))
  const pricingBands = selected
    ? mockData.S4.pricing_bands.filter(pb => pb.buyer_id === selected.buyer_id)
    : []

  function advanceStatus(buyer) {
    const action = STAGE_ACTIONS[buyer.status]
    if (action) setBuyerStatuses(s => ({ ...s, [buyer.buyer_id]: action.next }))
  }

  const listColumns = [
    { key: 'legal_name',        label: 'Legal Name' },
    { key: 'sector',            label: 'Sector' },
    { key: 'rating',            label: 'Rating',        render: row => `${row.rating} (${row.rating_source})` },
    { key: 'credit_limit_paise', label: 'Credit Limit', render: row => row.credit_limit_paise ? formatPaise(row.credit_limit_paise) : '—' },
    { key: 'status',            label: 'Status',        render: row => <StatusBadge label={row.status.replace(/_/g, ' ')} color={STATUS_COLOR[row.status] ?? 'gray'} /> },
    { key: 'last_review_at',    label: 'Last Review',   render: row => row.last_review_at ? formatDate(row.last_review_at) : '—' },
    { key: 'action',            label: '',              render: row => <Button variant="ghost" className="text-xs py-1 px-3" onClick={() => setSelected({ ...row, status: buyerStatuses[row.buyer_id] })}>Open →</Button> },
  ]

  const bandColumns = [
    { key: 'tenor_bucket', label: 'Tenor Bucket' },
    { key: 'rate_bps',     label: 'Rate',   render: row => `${(row.rate_bps / 100).toFixed(2)}% p.a.` },
    { key: 'fee_bps',      label: 'Fee',    render: row => `${(row.fee_bps / 100).toFixed(2)}%` },
  ]

  const currentStatus = selected ? buyerStatuses[selected.buyer_id] : null
  const stageAction   = currentStatus ? STAGE_ACTIONS[currentStatus] : null
  const isFourEyes    = fourEyes || (selected?.credit_limit_paise ?? 0) > 1000000000

  return (
    <div>
      <PageHeader title="Buyer Management" subtitle="Credit review and limit setting — Credit Reviewer" />

      {/* Four-eyes demo toggle */}
      <div className="flex items-center gap-2 mb-4">
        <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
          <input type="checkbox" checked={fourEyes} onChange={e => setFourEyes(e.target.checked)} />
          Preview: Four-eyes required (DL-023/C6)
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Buyer list */}
        <div className={selected ? 'lg:col-span-2' : 'lg:col-span-5'}>
          <Table columns={listColumns} rows={buyers} />
        </div>

        {/* Side panel */}
        {selected && (
          <div className="lg:col-span-3 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">{selected.legal_name}</h2>
              <button className="text-xs text-gray-400 hover:text-gray-700" onClick={() => setSelected(null)}>✕</button>
            </div>

            {/* Identity card */}
            <Card title="Identity (DL-010)">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div><p className="text-xs text-gray-400">MCA CIN</p><p className="font-mono text-gray-900 text-xs">{selected.mca_cin}</p></div>
                <div><p className="text-xs text-gray-400">GSTIN</p><p className="font-mono text-gray-900 text-xs">{selected.gstin}</p></div>
                <div><p className="text-xs text-gray-400">Sector</p><p className="text-gray-900">{selected.sector}</p></div>
                <div><p className="text-xs text-gray-400">Rating</p><p className="font-semibold text-gray-900">{selected.rating} <span className="font-normal text-gray-500 text-xs">({selected.rating_source})</span></p></div>
                <div><p className="text-xs text-gray-400">Tier (Phase 1)</p><p className="text-gray-900">{selected.relationship_tier} (DL-020)</p></div>
                <div><p className="text-xs text-gray-400">Ack Mode</p><p className="text-gray-900">{selected.acknowledgment_mode} (DL-019)</p></div>
              </div>
            </Card>

            {/* Credit profile */}
            <Card title="Credit Profile">
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Credit Limit (₹)" id="cl" placeholder="e.g. 1000000" defaultValue={selected.credit_limit_paise ? selected.credit_limit_paise / 100 : ''} type="number" />
                  <FormField label="Tenor Cap (days)"  id="tc" placeholder="90" type="number" defaultValue={selected.tenor_cap_days ?? ''} />
                </div>

                {isFourEyes && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs font-semibold text-amber-800 mb-2">Four-Eyes Required (DL-023 / C6) — credit limit {'>'} ₹1 Cr</p>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-gray-700">Second Approver</label>
                      <select className="rounded-md border border-amber-300 bg-white px-3 py-2 text-sm" value={approver} onChange={e => setApprover(e.target.value)}>
                        <option value="">— select checker —</option>
                        <option value="founder">Founder / CEO</option>
                      </select>
                    </div>
                  </div>
                )}

                <Button disabled={isFourEyes && !approver}>Set / Update Credit Limit</Button>
                <p className="text-xs text-gray-400">G20: Credit limit changes don't affect in-flight listings.</p>

                {pricingBands.length > 0 && (
                  <>
                    <h3 className="text-xs font-semibold text-gray-600 mt-2">Pricing Bands (DL-022)</h3>
                    <Table columns={bandColumns} rows={pricingBands} />
                  </>
                )}
              </div>
            </Card>

            {/* Stage action */}
            {stageAction && (
              <Card title="Onboarding Action">
                <div className="flex items-center gap-3">
                  <StatusBadge label={currentStatus.replace(/_/g, ' ')} color={STATUS_COLOR[currentStatus] ?? 'gray'} />
                  <Button onClick={() => advanceStatus({ ...selected, status: currentStatus })}>{stageAction.label}</Button>
                </div>
              </Card>
            )}
            {currentStatus === 'active' && (
              <Card><div className="flex items-center gap-2"><StatusBadge label="Active" color="green" /><span className="text-sm text-gray-600">Buyer fully onboarded.</span></div></Card>
            )}
          </div>
        )}
      </div>

      <Button variant="ghost" className="mt-6 text-sm" onClick={() => navigate('/s2')}>← Back to Dashboard</Button>
      <p className="text-xs text-gray-400 mt-2">Rules: DL-022 · DL-023/C6 (four-eyes) · DL-019 (per-invoice ack) · DL-020 (acknowledged_buyer only Phase 1)</p>
    </div>
  )
}
