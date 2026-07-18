import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/kit/Button.jsx'
import Card from '../../components/kit/Card.jsx'
import FormField from '../../components/kit/FormField.jsx'
import PageHeader from '../../components/kit/PageHeader.jsx'
import StatusBadge from '../../components/kit/StatusBadge.jsx'
import { investors as investorsSvc } from '../../api/services/index.js'
import { describe } from '../../api/errors.js'
import { IS_LIVE } from '../../config.js'

// investor lifecycle (backend, BC7): signed_up → identity_verified → kyc_submitted → suitability_assessed →
// financial_profile_completed → kyc_approved → mia_signed → active. Admin-assisted (ops-on-behalf until BE-18):
// OPS drives most steps; COMPLIANCE gates invite-issue (S8), suitability, and KYC approval (SoD).
const STAGES = ['Signed Up', 'Identity', 'KYC Submitted', 'Suitability', 'Financial', 'KYC Approved', 'MIA Signed', 'Active']
const STATUS_TO_STEP = { signed_up: 0, identity_verified: 1, kyc_submitted: 2, suitability_assessed: 3, financial_profile_completed: 4, kyc_approved: 5, mia_signed: 6, active: 7 }
const STATUS_COLOR = { signed_up: 'gray', identity_verified: 'amber', kyc_submitted: 'amber', suitability_assessed: 'amber', financial_profile_completed: 'amber', kyc_approved: 'amber', mia_signed: 'amber', active: 'green', kyc_rejected: 'red' }

// The next command for the single-button statuses. Form-bearing statuses (identity, suitability, financial) are
// special-cased in the render. Roles differ (SoD) — a step you lack the role for returns 403 (shown inline).
const NEXT = {
  identity_verified:           { label: 'Submit KYC (OPS)',          run: (id, v) => investorsSvc.submitKyc(id, v) },
  financial_profile_completed: { label: 'Approve KYC (COMPLIANCE)',  run: (id, v) => investorsSvc.recordKycApproved(id, v) },
  kyc_approved:                { label: 'Record MIA Signed (OPS)',   run: (id, v) => investorsSvc.recordMiaSigned(id, v) },
  mia_signed:                  { label: 'Activate (OPS)',            run: (id, v) => investorsSvc.activate(id, v) },
}

export default function S10() {
  const navigate = useNavigate()
  const [inv, setInv]         = useState(null)   // { investor_id, status, aggregate_version }
  const [invites, setInvites] = useState([])     // pending invites (BE-9) to pick an invite_id from
  const [su, setSu]           = useState({ invite_id: '', email: '', phone: '', sub_type: 'resident_individual' })
  const [idForm, setIdForm]   = useState({ pan: '', aadhaar_last4: '' })
  const [bank, setBank]       = useState('')
  const [mismatch, setMismatch] = useState(false)
  const [overrideText, setOverrideText] = useState('')
  const [resumeId, setResumeId] = useState('')
  const [busy, setBusy]       = useState(false)
  const [msg, setMsg]         = useState('')
  const [err, setErr]         = useState('')

  // Live: load pending invites so the admin can pick an invite_id to sign up against (no-op in mock mode).
  useEffect(() => {
    if (!IS_LIVE) return
    investorsSvc.listInvites('pending').then(rows => setInvites(rows ?? [])).catch(() => {})
  }, [])

  const refresh = async (id) => { const d = await investorsSvc.get(id); setInv({ investor_id: id, ...d }); return d }

  async function signUp() {
    setErr(''); setMsg(''); setBusy(true)
    try {
      const env = await investorsSvc.signUp({ invite_id: su.invite_id, email: su.email, phone: su.phone, sub_type: su.sub_type })
      await refresh(env.aggregate_id)
      setMsg('Investor signed up.')
    } catch (e) { setErr(describe(e)) } finally { setBusy(false) }
  }
  async function resume() {
    setErr(''); setMsg(''); setBusy(true)
    try { await refresh(resumeId.trim()) } catch (e) { setErr(describe(e)) } finally { setBusy(false) }
  }
  // Run one transition with a fresh version, then refresh the investor.
  async function run(fn) {
    setErr(''); setMsg(''); setBusy(true)
    try {
      const id = inv.investor_id
      const v = (await investorsSvc.get(id)).aggregate_version
      await fn(id, v)
      await refresh(id)
      setMsg('Step recorded.')
    } catch (e) { setErr(describe(e)) } finally { setBusy(false) }
  }

  // ── Entry: sign up a new investor (from a pending invite) or resume one by id ──
  if (!inv) {
    return (
      <div className="max-w-2xl mx-auto">
        <PageHeader title="Investor Onboarding" subtitle="Ops Executive workspace — admin-assisted (ops-on-behalf until investor self-login, BE-18)" />
        <Card title="Sign up a new investor" className="mb-4">
          <div className="flex flex-col gap-3">
            {invites.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Pending invite (BE-9)</label>
                <select className="rounded-md border border-gray-300 px-3 py-2 text-sm" value={su.invite_id} onChange={e => setSu(s => ({ ...s, invite_id: e.target.value }))}>
                  <option value="">— select an invite —</option>
                  {invites.map(iv => <option key={iv.invite_id} value={iv.invite_id}>{iv.invite_id.slice(0, 8)}… · issued {iv.issued_at?.slice(0, 10)}</option>)}
                </select>
              </div>
            )}
            <FormField label="Invite ID" id="inviteId" value={su.invite_id} onChange={e => setSu(s => ({ ...s, invite_id: e.target.value }))} placeholder="from S8 (Investor Invites)" />
            <FormField label="Email" id="email" type="email" value={su.email} onChange={e => setSu(s => ({ ...s, email: e.target.value }))} placeholder="investor@example.com" />
            <FormField label="Phone" id="phone" type="tel" value={su.phone} onChange={e => setSu(s => ({ ...s, phone: e.target.value }))} placeholder="+9198…" />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Investor Type</label>
              <select className="rounded-md border border-gray-300 px-3 py-2 text-sm" value={su.sub_type} onChange={e => setSu(s => ({ ...s, sub_type: e.target.value }))}>
                <option value="resident_individual">Resident Individual</option>
                <option value="huf">HUF</option>
              </select>
            </div>
            <Button disabled={busy || !su.invite_id || !su.email || !su.phone} onClick={signUp}>{busy ? 'Signing up…' : 'Sign Up (OPS)'}</Button>
          </div>
        </Card>
        <Card title="Resume an investor">
          <div className="flex items-end gap-2">
            <div className="flex-1"><FormField label="Investor ID" id="resumeId" value={resumeId} onChange={e => setResumeId(e.target.value)} placeholder="paste an investor_id" /></div>
            <Button variant="ghost" disabled={busy || !resumeId.trim()} onClick={resume}>Load</Button>
          </div>
        </Card>
        {err && <p className="text-xs text-red-600 mt-3">Failed: {err}</p>}
        <p className="text-xs text-gray-400 mt-4">Rules: DL-008/C20 (invite-gated) · DL-050 (full KYC stack before activation) · C15 (Aadhaar last4 only) · IA.3 · C21/G26 (suitability override). Spans OPS · COMPLIANCE (SoD).</p>
      </div>
    )
  }

  // ── Status-driven onboarding wizard ──
  const status = inv.status
  const step = STATUS_TO_STEP[status] ?? 0
  const next = NEXT[status]
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-5 p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-center gap-3">
        <span className="text-amber-600">⚠</span>
        <span className="font-semibold text-amber-900 text-sm flex-1">Onboarding investor: {inv.investor_id.slice(0, 8)}…</span>
        <Button variant="ghost" className="text-xs" onClick={() => { setInv(null); setErr(''); setMsg('') }}>Exit</Button>
      </div>
      <PageHeader title="Investor Onboarding" subtitle={`Current status: ${String(status ?? '—').replace(/_/g, ' ')}`} />

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

      <Card title={`${String(status ?? '—').replace(/_/g, ' ')}`}>
        {status === 'signed_up' ? (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-gray-500">Verify identity — PAN + Aadhaar last-4 only (C15).</p>
            <FormField label="PAN" id="pan" value={idForm.pan} onChange={e => setIdForm(f => ({ ...f, pan: e.target.value }))} placeholder="ABCDE1234F" maxLength={10} />
            <FormField label="Aadhaar last 4" id="a4" value={idForm.aadhaar_last4} onChange={e => setIdForm(f => ({ ...f, aadhaar_last4: e.target.value }))} placeholder="1234" maxLength={4} />
            <Button disabled={busy || !idForm.pan || idForm.aadhaar_last4.length !== 4} onClick={() => run((id, v) => investorsSvc.recordIdentityVerified(id, { pan: idForm.pan, aadhaar_last4: idForm.aadhaar_last4 }, v))}>{busy ? 'Working…' : 'Record Identity Verified (OPS)'}</Button>
          </div>
        ) : status === 'kyc_submitted' ? (
          <div className="flex flex-col gap-3">
            <label className="flex gap-2 items-center text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={mismatch} onChange={e => setMismatch(e.target.checked)} />
              Suitability mismatch (C21/G26)
            </label>
            <Button disabled={busy} onClick={() => run((id, v) => investorsSvc.assessSuitability(id, { mismatch }, v))}>{busy ? 'Working…' : 'Assess Suitability (COMPLIANCE)'}</Button>
          </div>
        ) : status === 'suitability_assessed' ? (
          <div className="flex flex-col gap-3">
            <details className="text-xs text-gray-500">
              <summary className="cursor-pointer">Record a suitability override (if a mismatch was flagged)</summary>
              <div className="flex items-end gap-2 mt-2">
                <div className="flex-1"><FormField label="Override note" id="ovr" value={overrideText} onChange={e => setOverrideText(e.target.value)} placeholder="investor acknowledges elevated risk" /></div>
                <Button variant="ghost" disabled={busy || !overrideText} onClick={() => run((id, v) => investorsSvc.acknowledgeSuitabilityOverride(id, { override_text: overrideText }, v))}>Acknowledge (COMPLIANCE)</Button>
              </div>
            </details>
            <FormField label="Bank account last 4" id="bank" value={bank} onChange={e => setBank(e.target.value)} placeholder="6789" maxLength={4} />
            <Button disabled={busy || bank.length !== 4} onClick={() => run((id, v) => investorsSvc.completeFinancialProfile(id, { bank_account_last4: bank }, v))}>{busy ? 'Working…' : 'Complete Financial Profile (OPS)'}</Button>
          </div>
        ) : status === 'active' ? (
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2"><StatusBadge label="Active" color="green" /><span className="text-sm text-gray-600">Investor fully onboarded.</span></div>
            <Button onClick={() => navigate('/s11')}>Browse Listings →</Button>
          </div>
        ) : next ? (
          <div className="flex items-center gap-3">
            <StatusBadge label={String(status).replace(/_/g, ' ')} color={STATUS_COLOR[status] ?? 'gray'} />
            <Button disabled={busy} onClick={() => run(next.run)}>{busy ? 'Working…' : next.label}</Button>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No action for status “{status}”.</p>
        )}
        {msg && <p className="text-xs text-green-600 mt-3">{msg}</p>}
        {err && <p className="text-xs text-red-600 mt-3">Failed: {err}</p>}
      </Card>

      <Button variant="ghost" className="mt-6 text-sm" onClick={() => navigate('/s2')}>← Back to Dashboard</Button>
      <p className="text-xs text-gray-400 mt-3">SoD: OPS (identity / kyc-submit / financial / mia / activate) · COMPLIANCE (suitability, kyc-approve). Re-login as the right dev account per step; a role you don't hold shows 403.</p>
    </div>
  )
}
