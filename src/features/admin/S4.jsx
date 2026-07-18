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
import { buyers as buyersSvc } from '../../api/services/index.js'
import { describe } from '../../api/errors.js'
import { useStore } from '../../store/PlatformStore.jsx'
import { useHydrate } from '../../store/useHydrate.js'

// buyer_account_status lifecycle (backend): nominated → identity_verified → credit_assessed → engagement_started → active
const STATUS_COLOR = { nominated: 'gray', identity_verified: 'amber', credit_assessed: 'amber', engagement_started: 'amber', active: 'green', suspended: 'red' }

const STAGE_ACTIONS = {
  nominated:          { label: 'Record Identity Verified', next: 'identity_verified' },   // POST /buyers/{id}/record-identity-verified
  identity_verified:  { label: 'Record Credit Assessment', next: 'credit_assessed' },      // POST /buyers/{id}/record-credit-assessment
  credit_assessed:    { label: 'Start Engagement',         next: 'engagement_started' },   // POST /buyers/{id}/start-engagement
  engagement_started: { label: 'Activate Buyer',           next: 'active' },               // POST /buyers/{id}/activate
  active:             null,
}

export default function S4() {
  const navigate = useNavigate()
  const { listBuyers, getBuyer } = useStore()
  const live = useHydrate('buyers')                    // live mode: fetch GET /buyers into the store (BE-5)
  const [selected, setSelected]     = useState(null)
  const [fourEyes, setFourEyes]     = useState(false)
  const [limitInput, setLimitInput] = useState('')
  const [savedMsg, setSavedMsg]     = useState('')
  const [errMsg, setErrMsg]         = useState('')
  const [busy, setBusy]             = useState(false)
  const [approver, setApprover] = useState('')
  const [nominating, setNominating] = useState(false)
  const [nomForm, setNomForm] = useState({ legal_name: '', mca_cin: '', gstin: '', sector: '' })
  const [ackForm, setAckForm] = useState({ email: '', phone: '', display_name: '' })

  const buyers = listBuyers()
  const freshVer = async (id) => (await buyersSvc.get(id)).aggregate_version   // list read omits version; read it per command

  // Activation (OPS) is a 3-command sub-chain: designate-ack-user → confirm-payment-instruction → activate.
  // BA.3: activation requires an active acknowledgment user, so it can't be a single transition.
  async function completeActivation() {
    const id = selected.buyer_id
    if (!ackForm.email || !ackForm.phone || !ackForm.display_name) { setErrMsg('Enter ack-user email, phone, and name'); return }
    setSavedMsg(''); setErrMsg(''); setBusy(true)
    try {
      await buyersSvc.designateAckUser(id, { ...ackForm }, await freshVer(id))
      await buyersSvc.confirmPaymentInstruction(id, await freshVer(id))
      await buyersSvc.activate(id, await freshVer(id))
      await live.reload()
      setSavedMsg('Buyer activated.')
    } catch (e) { setErrMsg(describe(e)) } finally { setBusy(false) }
  }

  // Start the chain: POST /buyers/nominate (CREDIT role) → refresh the list.
  async function nominateBuyer() {
    setSavedMsg(''); setErrMsg(''); setBusy(true)
    try {
      await buyersSvc.nominate({ legal_name: nomForm.legal_name, mca_cin: nomForm.mca_cin, gstin: nomForm.gstin, sector: nomForm.sector })
      await live.reload()
      setNominating(false); setNomForm({ legal_name: '', mca_cin: '', gstin: '', sector: '' })
      setSavedMsg('Buyer nominated.')
    } catch (e) { setErrMsg(describe(e)) } finally { setBusy(false) }
  }

  function openBuyer(row) {
    setSelected(row)
    setLimitInput(row.credit_limit_paise ? String(row.credit_limit_paise / 100) : '')
    setSavedMsg('')
  }

  // Direct backend transition (no in-memory fallback). record-credit-assessment carries the limit and advances
  // the buyer's state → it needs the current aggregate_version (the list read BE-5 omits it, so read it fresh).
  async function saveCreditLimit() {
    const paise = Math.round(Number(limitInput) * 100)
    if (!Number.isFinite(paise) || paise <= 0) { setErrMsg('Enter a valid amount'); return }
    setSavedMsg(''); setErrMsg(''); setBusy(true)
    try {
      const { aggregate_version } = await buyersSvc.get(selected.buyer_id)                                 // GET current version
      await buyersSvc.recordCreditAssessment(selected.buyer_id, { credit_limit_paise: paise }, aggregate_version) // POST + X-Aggregate-Version
      await live.reload()                                                                                  // GET /buyers (refresh)
      setSavedMsg(`Credit limit set to ${formatPaise(paise)}.`)
    } catch (e) {
      setErrMsg(describe(e))
    } finally {
      setBusy(false)
    }
  }
  const pricingBands = selected
    ? mockData.S4.pricing_bands.filter(pb => pb.buyer_id === selected.buyer_id)
    : []

  // The buyer transition chain — each step is a direct backend command with the current aggregate_version.
  // Roles differ per step (SoD): identity-verified/start-engagement/activate = OPS, credit-assessment = CREDIT;
  // a step you lack the role for returns 403 (shown inline) — re-login as the right dev account to proceed.
  async function advanceStatus() {
    const id = selected.buyer_id
    setSavedMsg(''); setErrMsg(''); setBusy(true)
    try {
      const { aggregate_version: v } = await buyersSvc.get(id)                       // fresh version per step
      if (currentStatus === 'nominated')            await buyersSvc.recordIdentityVerified(id, v)
      else if (currentStatus === 'identity_verified') {
        const paise = Math.round(Number(limitInput) * 100)
        if (!Number.isFinite(paise) || paise <= 0) throw new Error('Enter a credit limit in the Credit Profile card first')
        await buyersSvc.recordCreditAssessment(id, { credit_limit_paise: paise }, v)
      }
      else if (currentStatus === 'credit_assessed')    await buyersSvc.startEngagement(id, v)
      else if (currentStatus === 'engagement_started') await buyersSvc.activate(id, v)
      await live.reload()
      setSavedMsg(`${stageAction.label} done.`)
    } catch (e) { setErrMsg(describe(e)) } finally { setBusy(false) }
  }

  const listColumns = [
    { key: 'legal_name',        label: 'Legal Name' },
    { key: 'sector',            label: 'Sector' },
    { key: 'rating',            label: 'Rating',        render: row => `${row.rating} (${row.rating_source})` },
    { key: 'credit_limit_paise', label: 'Credit Limit', render: row => row.credit_limit_paise ? formatPaise(row.credit_limit_paise) : '—' },
    { key: 'status',            label: 'Status',        render: row => <StatusBadge label={row.status.replace(/_/g, ' ')} color={STATUS_COLOR[row.status] ?? 'gray'} /> },
    { key: 'last_review_at',    label: 'Last Review',   render: row => row.last_review_at ? formatDate(row.last_review_at) : '—' },
    { key: 'action',            label: '',              render: row => <Button variant="ghost" className="text-xs py-1 px-3" onClick={() => openBuyer(row)}>Open →</Button> },
  ]

  const bandColumns = [
    { key: 'tenor_bucket', label: 'Tenor Bucket' },
    { key: 'rate_bps',     label: 'Rate',   render: row => `${(row.rate_bps / 100).toFixed(2)}% p.a.` },
    { key: 'fee_bps',      label: 'Fee',    render: row => `${(row.fee_bps / 100).toFixed(2)}%` },
  ]

  const currentBuyer  = selected ? getBuyer(selected.buyer_id) : null
  const currentStatus = currentBuyer?.status ?? null
  const stageAction   = currentStatus ? STAGE_ACTIONS[currentStatus] : null
  const isFourEyes    = fourEyes || (currentBuyer?.credit_limit_paise ?? 0) > 1000000000

  return (
    <div>
      <PageHeader title="Buyer Management" subtitle="Credit review and limit setting — Credit Reviewer" />

      {live.error && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">Live load failed: {live.error}</div>}
      {live.loading && <p className="text-xs text-gray-400 mb-3">Loading buyers…</p>}

      {/* Four-eyes demo toggle */}
      <div className="flex items-center gap-2 mb-4">
        <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
          <input type="checkbox" checked={fourEyes} onChange={e => setFourEyes(e.target.checked)} />
          Preview: Four-eyes required (DL-023/C6)
        </label>
      </div>

      {/* Nominate a new buyer (starts the onboarding chain) */}
      {!selected && (
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-sm font-semibold text-gray-700">Buyers</h2>
            <Button className="text-xs py-1.5 px-4" onClick={() => setNominating(n => !n)}>{nominating ? 'Cancel' : '+ Nominate Buyer'}</Button>
          </div>
          {nominating && (
            <Card className="mb-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Legal Name" id="nm_ln" value={nomForm.legal_name} onChange={e => setNomForm(f => ({ ...f, legal_name: e.target.value }))} />
                <FormField label="Sector" id="nm_sec" value={nomForm.sector} onChange={e => setNomForm(f => ({ ...f, sector: e.target.value }))} placeholder="e.g. Manufacturing" />
                <FormField label="MCA CIN" id="nm_cin" value={nomForm.mca_cin} onChange={e => setNomForm(f => ({ ...f, mca_cin: e.target.value }))} placeholder="L17110MH1973PLC019786" />
                <FormField label="GSTIN" id="nm_gst" value={nomForm.gstin} onChange={e => setNomForm(f => ({ ...f, gstin: e.target.value }))} placeholder="27AAACR5055K1ZT" />
              </div>
              <Button className="mt-3" disabled={busy || !nomForm.legal_name || !nomForm.mca_cin || !nomForm.gstin || !nomForm.sector} onClick={nominateBuyer}>{busy ? 'Nominating…' : 'Nominate (CREDIT role)'}</Button>
              {errMsg && <p className="text-xs text-red-600 mt-2">Nominate failed: {errMsg}</p>}
            </Card>
          )}
        </div>
      )}

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
                  <FormField label="Credit Limit (₹)" id="cl" placeholder="e.g. 1000000" value={limitInput} onChange={e => setLimitInput(e.target.value)} type="number" />
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

                <Button disabled={busy || (isFourEyes && !approver)} onClick={saveCreditLimit}>{busy ? 'Saving…' : 'Set / Update Credit Limit'}</Button>
                {savedMsg && <p className="text-xs text-green-600">{savedMsg}</p>}
                {errMsg && <p className="text-xs text-red-600">Save failed: {errMsg}</p>}
                <p className="text-xs text-gray-400">G20: Credit limit changes don't affect in-flight listings.</p>

                {pricingBands.length > 0 && (
                  <>
                    <h3 className="text-xs font-semibold text-gray-600 mt-2">Pricing Bands (DL-022)</h3>
                    <Table columns={bandColumns} rows={pricingBands} />
                  </>
                )}
              </div>
            </Card>

            {/* Stage action (single transition) */}
            {stageAction && currentStatus !== 'engagement_started' && (
              <Card title="Onboarding Action">
                <div className="flex items-center gap-3">
                  <StatusBadge label={currentStatus.replace(/_/g, ' ')} color={STATUS_COLOR[currentStatus] ?? 'gray'} />
                  <Button disabled={busy} onClick={advanceStatus}>{busy ? 'Working…' : stageAction.label}</Button>
                </div>
                {errMsg && <p className="text-xs text-red-600 mt-2">Failed: {errMsg}</p>}
                {savedMsg && <p className="text-xs text-green-600 mt-2">{savedMsg}</p>}
              </Card>
            )}

            {/* Activation (engagement_started) — needs an ack-user first (BA.3), so it's a 3-command sub-chain */}
            {currentStatus === 'engagement_started' && (
              <Card title="Activate Buyer — designate an acknowledgment user (BA.3)">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                  <FormField label="Ack-User Email" id="ack_e" value={ackForm.email} onChange={e => setAckForm(f => ({ ...f, email: e.target.value }))} />
                  <FormField label="Phone" id="ack_p" value={ackForm.phone} onChange={e => setAckForm(f => ({ ...f, phone: e.target.value }))} placeholder="+919000012345" />
                  <FormField label="Name" id="ack_n" value={ackForm.display_name} onChange={e => setAckForm(f => ({ ...f, display_name: e.target.value }))} />
                </div>
                <Button disabled={busy} onClick={completeActivation}>{busy ? 'Activating…' : 'Designate Ack-User, Confirm PI & Activate (OPS)'}</Button>
                {errMsg && <p className="text-xs text-red-600 mt-2">Failed: {errMsg}</p>}
                {savedMsg && <p className="text-xs text-green-600 mt-2">{savedMsg}</p>}
              </Card>
            )}
            {currentStatus === 'active' && (
              <Card>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2"><StatusBadge label="Active" color="green" /><span className="text-sm text-gray-600">Buyer fully onboarded.</span></div>
                  <Button variant="ghost" className="text-xs" onClick={() => navigate('/s15')}>Open Buyer Portal →</Button>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>

      <Button variant="ghost" className="mt-6 text-sm" onClick={() => navigate('/s2')}>← Back to Dashboard</Button>
      <p className="text-xs text-gray-400 mt-2">Rules: DL-022 · DL-023/C6 (four-eyes) · DL-019 (per-invoice ack) · DL-020 (acknowledged_buyer only Phase 1)</p>
    </div>
  )
}
