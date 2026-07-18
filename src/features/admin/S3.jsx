import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/kit/Button.jsx'
import Card from '../../components/kit/Card.jsx'
import FormField from '../../components/kit/FormField.jsx'
import PageHeader from '../../components/kit/PageHeader.jsx'
import StatusBadge from '../../components/kit/StatusBadge.jsx'
import Table from '../../components/kit/Table.jsx'
import { formatDate } from '../../utils/format.js'
import { suppliers as suppliersSvc } from '../../api/services/index.js'
import { describe } from '../../api/errors.js'
import { useStore } from '../../store/PlatformStore.jsx'
import { useHydrate } from '../../store/useHydrate.js'

// supplier lifecycle (backend): created → identity_verified → kyc_submitted → kyc_approved → credit_reviewed → maa_signed → active
const STAGES = ['Created', 'Identity', 'KYC Submitted', 'KYC Approved', 'Credit Reviewed', 'MAA Signed', 'Active']
const STATUS_TO_STEP = { created: 0, identity_verified: 1, kyc_submitted: 2, kyc_approved: 3, credit_reviewed: 4, maa_signed: 5, active: 6 }
const STATUS_COLOR = { created: 'gray', identity_verified: 'amber', kyc_submitted: 'amber', kyc_approved: 'amber', credit_reviewed: 'amber', maa_signed: 'amber', active: 'green', suspended: 'red' }

// The next command for each status. Roles differ (SoD): OPS for most, COMPLIANCE for KYC approval (maker-checker),
// CREDIT for credit review. A step you lack the role for returns 403 (shown inline). kyc_approved is special-cased
// in the render (financial-profile + credit-review form).
const NEXT = {
  created:           { label: 'Record Identity Verified (OPS)', run: (id, v) => suppliersSvc.recordIdentityVerified(id, v) },
  identity_verified: { label: 'Submit KYC (OPS)',               run: (id, v) => suppliersSvc.submitKyc(id, v) },
  kyc_submitted:     { label: 'Approve KYC (COMPLIANCE)',       run: (id, v) => suppliersSvc.recordKycApproved(id, v) },
  credit_reviewed:   { label: 'Record MAA Signed (OPS)',        run: (id, v) => suppliersSvc.recordMaaSigned(id, v) },
  maa_signed:        { label: 'Activate (OPS)',                 run: (id, v) => suppliersSvc.activate(id, v) },
}

export default function S3() {
  const navigate = useNavigate()
  const { listSuppliers, getSupplier } = useStore()
  const live = useHydrate('suppliers')                 // live mode: fetch GET /suppliers into the store (BE-4)
  const [actingAs, setActingAs]   = useState(null)     // { supplier_id, ... } we're onboarding
  const [tab, setTab]             = useState('onboarding')
  const [creating, setCreating]   = useState(false)
  const [cForm, setCForm] = useState({ legal_name: '', constitution_type: 'private_limited', pan: '', gstin: '', cin: '' })
  const [creditForm, setCreditForm] = useState({ exposure_cap: '', risk_rating: 'A' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const suppliers = listSuppliers()
  const currentSup = actingAs ? (getSupplier(actingAs.supplier_id) ?? actingAs) : null
  const status = currentSup?.status
  const step = STATUS_TO_STEP[status] ?? 0
  const freshVer = async (id) => (await suppliersSvc.get(id)).aggregate_version

  async function submitCreate() {
    setErr(''); setMsg(''); setBusy(true)
    try {
      const env = await suppliersSvc.create({ ...cForm })                 // POST /suppliers/create (OPS)
      await live.reload()
      setCreating(false)
      setActingAs({ supplier_id: env.aggregate_id, ...cForm, status: 'created' })  // open the new supplier in the wizard
      setCForm({ legal_name: '', constitution_type: 'private_limited', pan: '', gstin: '', cin: '' })
    } catch (e) { setErr(describe(e)) } finally { setBusy(false) }
  }

  // Run one transition command with the current version, then refresh.
  async function runCmd(run) {
    const id = currentSup.supplier_id
    setErr(''); setMsg(''); setBusy(true)
    try {
      await run(id, await freshVer(id))
      await live.reload()
      setMsg('Step recorded.')
    } catch (e) { setErr(describe(e)) } finally { setBusy(false) }
  }
  const submitFinancialProfile = () => runCmd((id, v) => suppliersSvc.submitFinancialProfile(id, { top_buyers: [] }, v))
  function recordCreditReview() {
    const cap = Math.round(Number(creditForm.exposure_cap) * 100)
    if (!Number.isFinite(cap) || cap <= 0) { setErr('Enter an exposure cap'); return }
    runCmd((id, v) => suppliersSvc.recordCreditReview(id, { exposure_cap_paise: cap, risk_rating: creditForm.risk_rating }, v))
  }

  const listColumns = [
    { key: 'legal_name',        label: 'Legal Name' },
    { key: 'pan',               label: 'PAN' },
    { key: 'constitution_type', label: 'Constitution' },
    { key: 'status',            label: 'Status', render: row => <StatusBadge label={String(row.status).replace(/_/g, ' ')} color={STATUS_COLOR[row.status] ?? 'gray'} /> },
    { key: 'action',            label: '',       render: row => <Button variant="ghost" className="text-xs py-1 px-3" onClick={() => { setActingAs(row); setTab('onboarding'); setErr(''); setMsg('') }}>Open →</Button> },
  ]

  // ── List view ──
  if (!actingAs) {
    return (
      <div>
        <PageHeader title="Supplier Onboarding" subtitle="Ops Executive workspace — admin-assisted onboarding" />
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Suppliers {live.loading && <span className="text-xs font-normal text-gray-400">· loading…</span>}</h2>
          <Button className="text-xs py-1.5 px-4" onClick={() => setCreating(c => !c)}>{creating ? 'Cancel' : '+ Create New Supplier'}</Button>
        </div>
        {creating && (
          <Card className="mb-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Legal Name" id="c_ln" value={cForm.legal_name} onChange={e => setCForm(f => ({ ...f, legal_name: e.target.value }))} />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Constitution Type</label>
                <select className="rounded-md border border-gray-300 px-3 py-2 text-sm" value={cForm.constitution_type} onChange={e => setCForm(f => ({ ...f, constitution_type: e.target.value }))}>
                  <option value="private_limited">Private Limited</option>
                  <option value="llp">LLP</option>
                  <option value="partnership">Partnership</option>
                  <option value="proprietorship">Proprietorship</option>
                </select>
              </div>
              <FormField label="PAN" id="c_pan" value={cForm.pan} onChange={e => setCForm(f => ({ ...f, pan: e.target.value }))} placeholder="AABCA1234Z" />
              <FormField label="GSTIN" id="c_gst" value={cForm.gstin} onChange={e => setCForm(f => ({ ...f, gstin: e.target.value }))} placeholder="27AABCA1234Z1Z5" />
              <FormField label="CIN" id="c_cin" value={cForm.cin} onChange={e => setCForm(f => ({ ...f, cin: e.target.value }))} placeholder="U74999MH2015PTC123456" />
            </div>
            <Button className="mt-3" disabled={busy || !cForm.legal_name || !cForm.pan || !cForm.gstin || !cForm.cin} onClick={submitCreate}>{busy ? 'Creating…' : 'Create Supplier (OPS)'}</Button>
            {err && <p className="text-xs text-red-600 mt-2">Create failed: {err}</p>}
          </Card>
        )}
        {live.error && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">Live load failed: {live.error}</div>}
        <Table columns={listColumns} rows={suppliers} />
        <p className="text-xs text-gray-400 mt-2">Rules: DL-012 (admin-assisted) · DL-013/AC.3 · C24 (verified via GST/MCA). Onboarding spans OPS · COMPLIANCE · CREDIT roles (SoD).</p>
      </div>
    )
  }

  // ── Onboarding wizard (status-driven) ──
  const next = status ? NEXT[status] : null
  return (
    <div>
      <div className="mb-5 p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-center gap-3">
        <span className="text-amber-600">⚠</span>
        <span className="font-semibold text-amber-900 text-sm flex-1">Acting as: {currentSup.legal_name}</span>
        <Button variant="ghost" className="text-xs" onClick={() => { setActingAs(null); setErr(''); setMsg('') }}>Exit</Button>
      </div>

      <PageHeader title={currentSup.legal_name} subtitle={`${String(currentSup.constitution_type ?? '').replace('_', ' ')} · ${currentSup.pan ?? ''}`} />

      <div className="flex gap-1 border-b border-gray-200 mb-5">
        {['onboarding', 'action_log'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${tab === t ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t === 'onboarding' ? 'Onboarding' : 'Action Log'}
          </button>
        ))}
      </div>

      {tab === 'action_log' && <p className="text-sm text-gray-500">Agency action log surfaces from the audit read (M17) — deferred.</p>}

      {tab === 'onboarding' && (
        <>
          {/* Progress */}
          <div className="flex items-start gap-1 mb-6">
            {STAGES.map((label, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i < step ? 'bg-green-500 text-white' : i === step ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-400'}`}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span className={`text-[9px] text-center leading-tight ${i === step ? 'text-indigo-700 font-semibold' : 'text-gray-400'}`}>{label}</span>
              </div>
            ))}
          </div>

          <Card title={`Current status: ${String(status ?? '—').replace(/_/g, ' ')}`}>
            {status === 'kyc_approved' ? (
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-2">Financial profile (OPS), then credit review (CREDIT):</p>
                  <Button variant="ghost" disabled={busy} onClick={submitFinancialProfile}>{busy ? '…' : 'Submit Financial Profile (OPS)'}</Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField label="Exposure Cap (₹)" id="cap" type="number" value={creditForm.exposure_cap} onChange={e => setCreditForm(f => ({ ...f, exposure_cap: e.target.value }))} placeholder="e.g. 200000" />
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Risk Rating</label>
                    <select className="rounded-md border border-gray-300 px-3 py-2 text-sm" value={creditForm.risk_rating} onChange={e => setCreditForm(f => ({ ...f, risk_rating: e.target.value }))}>
                      {['AAA', 'AA', 'A', 'BBB', 'BB'].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
                <Button disabled={busy} onClick={recordCreditReview}>{busy ? 'Recording…' : 'Record Credit Review (CREDIT)'}</Button>
              </div>
            ) : status === 'active' ? (
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2"><StatusBadge label="Active" color="green" /><span className="text-sm text-gray-600">Supplier fully onboarded.</span></div>
                <Button onClick={() => navigate('/s14', { state: { supplierId: currentSup.supplier_id } })}>Open Supplier Portal →</Button>
              </div>
            ) : next ? (
              <div className="flex items-center gap-3">
                <StatusBadge label={String(status).replace(/_/g, ' ')} color={STATUS_COLOR[status] ?? 'gray'} />
                <Button disabled={busy} onClick={() => runCmd(next.run)}>{busy ? 'Working…' : next.label}</Button>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No action for status “{status}”.</p>
            )}
            {msg && <p className="text-xs text-green-600 mt-3">{msg}</p>}
            {err && <p className="text-xs text-red-600 mt-3">Failed: {err}</p>}
          </Card>
        </>
      )}

      <Button variant="ghost" className="mt-6 text-sm" onClick={() => navigate('/s2')}>← Back to Dashboard</Button>
      <p className="text-xs text-gray-400 mt-3">Onboarding is SoD: OPS (identity/kyc-submit/financial/maa/activate) · COMPLIANCE (kyc-approve) · CREDIT (credit-review). Re-login as the right dev account per step; a role you don't hold shows 403.</p>
    </div>
  )
}
