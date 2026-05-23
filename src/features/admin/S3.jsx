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

const VARIANTS = [
  { id: 'normal',                  label: 'Normal' },
  { id: 'agency_consent_missing',  label: 'Consent Missing' },
  { id: 'kyc_rejected',            label: 'KYC Rejected' },
]

const STAGES = ['Create Entity', 'Identity Verification', 'KYC Upload', 'Financial Profile', 'Credit Review', 'MAA e-Sign']

const STATUS_TO_STEP = { created: 0, identity_verified: 2, kyc_submitted: 3, kyc_in_review: 3, kyc_approved: 4, credit_reviewed: 5, maa_pending: 5, active: 6 }
const STATUS_COLOR = { created: 'gray', identity_verified: 'amber', kyc_submitted: 'amber', kyc_in_review: 'amber', kyc_approved: 'amber', credit_reviewed: 'amber', maa_pending: 'amber', active: 'green', suspended: 'red' }

const ACTION_LOG = [
  { at: '2026-05-01T10:05:00Z', action: 'AgencyAction.Recorded — Agency consent captured', actor: 'Ops Lead' },
  { at: '2026-05-02T09:00:00Z', action: 'AgencyAction.Recorded — KYC documents uploaded',  actor: 'Ops Lead' },
]

export default function S3() {
  const navigate = useNavigate()
  const [variant, setVariant]     = useState('normal')
  const [actingAs, setActingAs]   = useState(null)
  const [step, setStep]           = useState(0)
  const [tab, setTab]             = useState('onboarding')

  function openSupplier(supplier) {
    setActingAs(supplier)
    setStep(STATUS_TO_STEP[supplier.status] ?? 0)
    setTab('onboarding')
  }

  const listColumns = [
    { key: 'legal_name',         label: 'Legal Name' },
    { key: 'pan',                label: 'PAN' },
    { key: 'constitution_type',  label: 'Constitution' },
    { key: 'status',             label: 'Status', render: row => <StatusBadge label={row.status.replace(/_/g, ' ')} color={STATUS_COLOR[row.status] ?? 'gray'} /> },
    { key: 'consent',            label: 'Consent',   render: row => <StatusBadge label={row.agency_consent?.is_active ? 'Active' : 'Missing'} color={row.agency_consent?.is_active ? 'green' : 'red'} /> },
    { key: 'action',             label: '',          render: row => <Button variant="ghost" className="text-xs py-1 px-3" onClick={() => openSupplier(row)}>Open →</Button> },
  ]

  if (!actingAs) {
    return (
      <div>
        <PageHeader title="Supplier Onboarding" subtitle="Ops Executive workspace — admin-assisted onboarding" />
        <div className="flex gap-2 flex-wrap mb-6">
          <span className="text-xs text-gray-400 self-center">Preview state:</span>
          {VARIANTS.map(v => (
            <button key={v.id} onClick={() => setVariant(v.id)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${variant === v.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-300 hover:border-indigo-400'}`}>
              {v.label}
            </button>
          ))}
        </div>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Suppliers</h2>
          <Button className="text-xs py-1.5 px-4">+ Create New Supplier</Button>
        </div>
        <Table columns={listColumns} rows={mockData.S3.suppliers} />
        <p className="text-xs text-gray-400 mt-2">Rules: DL-012 (admin-assisted) · DL-013/AC.3 (all actions emit AgencyAction) · C24 (verified via GST/MCA)</p>
      </div>
    )
  }

  const noConsent = variant === 'agency_consent_missing'
  const kycRejected = variant === 'kyc_rejected' && step === 2

  return (
    <div>
      {/* Acting-as banner */}
      <div className="mb-5 p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-center gap-3">
        <span className="text-amber-600">⚠</span>
        <div className="flex-1">
          <span className="font-semibold text-amber-900 text-sm">Acting as: {actingAs.legal_name}</span>
          <span className="text-xs text-amber-700 ml-3">Agency Consent: {noConsent ? '❌ Missing' : '✓ Active'} · Scope: {actingAs.agency_consent?.scope?.join(', ')}</span>
        </div>
        <Button variant="ghost" className="text-xs" onClick={() => setActingAs(null)}>Exit</Button>
      </div>

      {noConsent && (
        <Card className="border-red-200 bg-red-50 mb-4">
          <p className="font-semibold text-red-800 text-sm mb-1">No Active Agency Consent (AC.1)</p>
          <p className="text-sm text-red-700">All actions are blocked until the supplier grants agency consent via the designated flow.</p>
        </Card>
      )}

      <PageHeader title={actingAs.legal_name} subtitle={`${actingAs.constitution_type.replace('_', ' ')} · ${actingAs.pan}`} />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-5">
        {['onboarding', 'action_log'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${tab === t ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t === 'onboarding' ? 'Onboarding Wizard' : 'Action Log (DL-013)'}
          </button>
        ))}
      </div>

      {tab === 'action_log' && (
        <div className="space-y-2">
          {ACTION_LOG.map((e, i) => (
            <div key={i} className="flex gap-4 text-sm p-3 bg-gray-50 rounded-lg border border-gray-100">
              <span className="text-xs text-gray-400 w-36 shrink-0">{formatDate(e.at)}</span>
              <span className="text-gray-700 flex-1">{e.action}</span>
              <span className="text-xs text-gray-400">{e.actor}</span>
            </div>
          ))}
        </div>
      )}

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

          {kycRejected && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="font-semibold text-red-800 text-sm mb-1">KYC Rejected</p>
              <p className="text-sm text-red-700 mb-3">Reason: Signatory KYC document expired. Please re-upload a valid document.</p>
              <Button variant="ghost" onClick={() => setStep(2)}>Re-submit KYC →</Button>
            </div>
          )}

          {step === 0 && (
            <Card title="Stage 1 — Create Entity (Verified via GST/MCA — C24)">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Legal Name" id="lname" defaultValue={actingAs.legal_name} />
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Constitution Type</label>
                  <select className="rounded-md border border-gray-300 px-3 py-2 text-sm"><option>Private Limited</option><option>LLP</option><option>Partnership</option></select>
                </div>
                <FormField label="PAN" id="pan" defaultValue={actingAs.pan} />
                <FormField label="GSTIN" id="gstin" defaultValue={actingAs.gstin} />
                <FormField label="CIN" id="cin" defaultValue={actingAs.cin} />
              </div>
              <Button className="mt-4" disabled={noConsent} onClick={() => setStep(1)}>Submit &amp; Trigger Verification</Button>
            </Card>
          )}

          {step === 1 && (
            <Card title="Stage 2 — Identity Verification">
              <div className="space-y-3 mb-4">
                {[['PAN', 'AABCA1234Z', 'pass'], ['GSTIN', '27AABCA1234Z1Z5', 'pass'], ['CIN / MCA', 'U74999MH2015PTC123456', 'pass']].map(([label, val, outcome]) => (
                  <div key={label} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div><p className="text-xs text-gray-500">{label}</p><p className="font-mono text-sm">{val}</p></div>
                    <StatusBadge label={outcome} color={outcome === 'pass' ? 'green' : 'red'} />
                  </div>
                ))}
              </div>
              <Button disabled={noConsent} onClick={() => setStep(2)}>Confirm &amp; Continue</Button>
            </Card>
          )}

          {step === 2 && (
            <Card title="Stage 3 — KYC Document Upload">
              <div className="space-y-3 mb-4">
                {['Constitution Documents', 'Signatory KYC', 'UBO Details'].map(doc => (
                  <div key={doc} className="flex items-center justify-between border border-dashed border-gray-300 rounded-lg px-4 py-3">
                    <span className="text-sm text-gray-700">{doc}</span>
                    <Button variant="ghost" className="text-xs" disabled={noConsent}>Mock Upload</Button>
                  </div>
                ))}
              </div>
              <Button disabled={noConsent} onClick={() => setStep(3)}>Submit KYC</Button>
            </Card>
          )}

          {step === 3 && (
            <Card title="Stage 4 — Financial Profile">
              <div className="flex flex-col gap-4 mb-4">
                <FormField label="GST Returns TTL" id="gst" placeholder="Last filed: Apr 2026" disabled={noConsent} />
                <FormField label="AA Bank Statement (months)" id="bank" placeholder="6" type="number" disabled={noConsent} />
                <FormField label="Top 3 Buyers (names)" id="buyers" placeholder="Reliance, Tata, Infosys" disabled={noConsent} />
              </div>
              <Button disabled={noConsent} onClick={() => setStep(4)}>Submit → Credit Review Queue</Button>
            </Card>
          )}

          {step === 4 && (
            <Card title="Stage 5 — Credit Review Outcome">
              <div className="flex flex-col gap-4 mb-4">
                <FormField label="Exposure Cap (₹)" id="cap" placeholder="e.g. 200000" type="number" disabled={noConsent} />
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Risk Rating</label>
                  <select className="rounded-md border border-gray-300 px-3 py-2 text-sm" disabled={noConsent}>
                    <option>AAA</option><option>AA</option><option selected>A</option><option>BBB</option>
                  </select>
                </div>
              </div>
              <Button disabled={noConsent} onClick={() => setStep(5)}>Record Outcome</Button>
            </Card>
          )}

          {step === 5 && (
            <Card title="Stage 6 — MAA e-Sign">
              <div className="text-center py-6">
                <p className="text-sm text-gray-700 mb-1">Master Agency Agreement ready for supplier's authorised signatory.</p>
                <p className="text-xs text-gray-400 mb-4">AC.2: e-sign is non-delegable — supplier's signatory must sign directly.</p>
                <Button disabled={noConsent} onClick={() => setStep(6)}>Initiate MAA e-Sign (Mock)</Button>
              </div>
            </Card>
          )}

          {step === 6 && (
            <Card>
              <div className="text-center py-6">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">✓</div>
                <p className="font-semibold text-gray-900">Supplier Activated</p>
                <p className="text-sm text-gray-500 mt-1">{actingAs.legal_name} is now active on the platform.</p>
                <div className="flex justify-center gap-3 mt-4">
                  <Button onClick={() => navigate('/s14')}>Open Supplier Portal →</Button>
                  <Button variant="ghost" onClick={() => setActingAs(null)}>← Back to Supplier List</Button>
                </div>
              </div>
            </Card>
          )}
        </>
      )}

      <Button variant="ghost" className="mt-6 text-sm" onClick={() => navigate('/s2')}>← Back to Dashboard</Button>
      <p className="text-xs text-gray-400 mt-3">Rules: DL-012 · DL-013/AC.3 · AC.2 (MAA non-delegable) · C24 (verified via GST/MCA)</p>
    </div>
  )
}
