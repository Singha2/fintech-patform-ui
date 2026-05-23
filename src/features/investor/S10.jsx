import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/kit/Button.jsx'
import Card from '../../components/kit/Card.jsx'
import FormField from '../../components/kit/FormField.jsx'
import PageHeader from '../../components/kit/PageHeader.jsx'
import StatusBadge from '../../components/kit/StatusBadge.jsx'
import mockData from '../../data/mockData.js'

const STAGES = ['Sign Up', 'Identity', 'KYC Upload', 'Financial Profile', 'Bank & Tax', 'Approval', 'MIA e-Sign', 'Activated']

// Maps investor.status to the wizard step index (0-based)
const STATUS_TO_STEP = {
  signed_up:        0,
  identity_verified: 2,
  kyc_submitted:    3,
  kyc_in_review:    5,
  kyc_approved:     6,
  mia_pending:      6,
  active:           7,
}

const VARIANTS = [
  { id: 'normal',             label: 'Normal Flow' },
  { id: 'invite_expired',     label: 'Invite Expired' },
  { id: 'mismatch',           label: 'Suitability Mismatch' },
  { id: 'kyc_rejected',       label: 'KYC Rejected' },
]

function VariantSwitcher({ value, onChange }) {
  return (
    <div className="flex items-center gap-2 flex-wrap mb-6">
      <span className="text-xs text-gray-400">Preview state:</span>
      {VARIANTS.map(v => (
        <button key={v.id} onClick={() => onChange(v.id)}
          className={`px-3 py-1 text-xs rounded-full border transition-colors ${value === v.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-300 hover:border-indigo-400'}`}>
          {v.label}
        </button>
      ))}
    </div>
  )
}

function ProgressBar({ activeStep }) {
  return (
    <>
      {/* Mobile: compact step indicator */}
      <div className="flex items-center gap-3 mb-6 md:hidden">
        <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
          {activeStep + 1}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">{STAGES[activeStep]}</p>
          <p className="text-xs text-gray-400">Step {activeStep + 1} of {STAGES.length}</p>
        </div>
        <div className="flex gap-0.5">
          {STAGES.map((_, i) => (
            <div key={i} className={`h-1.5 w-4 rounded-full ${i < activeStep ? 'bg-green-500' : i === activeStep ? 'bg-indigo-600' : 'bg-gray-200'}`} />
          ))}
        </div>
      </div>

      {/* Desktop: full step circles */}
      <div className="hidden md:flex items-start gap-1 mb-8">
        {STAGES.map((label, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0
              ${i < activeStep  ? 'bg-green-500 text-white' :
                i === activeStep ? 'bg-indigo-600 text-white' :
                                   'bg-gray-200 text-gray-400'}`}>
              {i < activeStep ? '✓' : i + 1}
            </div>
            <span className={`text-[9px] text-center leading-tight
              ${i === activeStep ? 'text-indigo-700 font-semibold' : 'text-gray-400'}`}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </>
  )
}

export default function S10() {
  const navigate = useNavigate()
  const [variant, setVariant] = useState('normal')
  const [step, setStep] = useState(STATUS_TO_STEP[mockData.S10.investor.status] ?? 0)
  const [suitabilityAcked, setSuitabilityAcked] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [copied, setCopied] = useState(false)

  function next() { setStep(s => Math.min(7, s + 1)) }
  function handleVariantChange(v) {
    setVariant(v)
    if (v === 'normal') setStep(STATUS_TO_STEP[mockData.S10.investor.status])
    if (v === 'kyc_rejected') setStep(2)
  }

  if (variant === 'invite_expired') {
    return (
      <div className="max-w-lg mx-auto mt-12">
        <VariantSwitcher value={variant} onChange={handleVariantChange} />
        <Card className="border-red-200 bg-red-50">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⛔</span>
            <div>
              <p className="font-semibold text-red-800 mb-1">Invite Expired</p>
              <p className="text-sm text-red-700">Your invitation has expired — invites are valid for 14 days (DL-008, C20). Please contact your relationship manager for a new invite code.</p>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader title="Investor Onboarding" subtitle="Complete all stages to activate your account" />
      <VariantSwitcher value={variant} onChange={handleVariantChange} />
      <ProgressBar activeStep={step} />

      {/* KYC Rejected banner — shown over stage 3 */}
      {variant === 'kyc_rejected' && step === 2 && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm font-semibold text-red-800 mb-1">KYC Rejected</p>
          <p className="text-sm text-red-700 mb-3">Reason: Document quality insufficient — please re-upload a clear, unobstructed copy of your address proof.</p>
          <Button variant="ghost" onClick={() => setStep(2)}>Re-submit KYC Documents</Button>
        </div>
      )}

      {/* Stage 1 — Sign Up */}
      {step === 0 && (
        <Card title="Stage 1 — Sign Up">
          <div className="flex flex-col gap-4">
            <FormField label="Email" id="email" type="email" defaultValue="investor@example.com" disabled />
            <FormField label="Phone" id="phone" type="tel" placeholder="+91 98765 43210" />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Investor Type</label>
              <select className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                <option value="resident_individual">Resident Individual</option>
                <option value="huf">HUF</option>
              </select>
            </div>
            <Button onClick={next}>Continue</Button>
          </div>
        </Card>
      )}

      {/* Stage 2 — Identity Verification */}
      {step === 1 && (
        <Card title="Stage 2 — Identity Verification">
          <div className="flex flex-col gap-4">
            <FormField label="PAN Number" id="pan" placeholder="ABCDE1234F" maxLength={10} />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Aadhaar OTP Verification</label>
              <p className="text-xs text-gray-400">Only last 4 digits stored — full number never retained (C15).</p>
              <div className="flex gap-2 mt-1">
                <input className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Aadhaar number" />
                <Button variant="ghost" onClick={() => setOtpSent(true)}>{otpSent ? 'OTP Sent ✓' : 'Send OTP'}</Button>
              </div>
              {otpSent && <FormField label="Enter OTP" id="otp" placeholder="6-digit OTP" />}
            </div>
            <Button onClick={next} disabled={!otpSent}>Verify & Continue</Button>
          </div>
        </Card>
      )}

      {/* Stage 3 — KYC Upload */}
      {step === 2 && (
        <Card title="Stage 3 — KYC Document Upload">
          <div className="flex flex-col gap-3">
            {['Address Proof', 'Photograph', 'Signature'].map(doc => (
              <div key={doc} className="flex items-center justify-between border border-dashed border-gray-300 rounded-lg px-4 py-3">
                <span className="text-sm text-gray-700">{doc}</span>
                <Button variant="ghost" className="text-xs">Mock Upload</Button>
              </div>
            ))}
            <Button className="mt-2" onClick={next}>Submit KYC</Button>
          </div>
        </Card>
      )}

      {/* Stage 4 — Financial Profile & Suitability */}
      {step === 3 && (
        <Card title="Stage 4 — Financial Profile & Suitability">
          {variant === 'mismatch' && !suitabilityAcked ? (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg mb-4">
              <p className="text-sm font-semibold text-amber-800 mb-1">Suitability Mismatch (C21, G26)</p>
              <p className="text-sm text-amber-700 mb-3">Your risk profile does not match this product's risk level. You may still proceed only after explicit acknowledgment that you understand the risks involved.</p>
              <Button onClick={() => setSuitabilityAcked(true)}>I Acknowledge & Wish to Proceed</Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <FormField label="Declared Annual Income (₹)" id="income" placeholder="e.g. 1500000" />
              <FormField label="Source of Funds" id="source" placeholder="e.g. Salary, Business income" />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Investment Experience</label>
                <select className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none">
                  <option>Less than 1 year</option>
                  <option>1–3 years</option>
                  <option>3–5 years</option>
                  <option>More than 5 years</option>
                </select>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Risk Tolerance Questionnaire</p>
                {[
                  'I can tolerate a loss of up to 10% of my investment.',
                  'I prefer predictable returns over higher-risk growth.',
                  'I understand this product is not capital-guaranteed.',
                ].map((q, i) => (
                  <label key={i} className="flex gap-3 items-start text-sm text-gray-600 cursor-pointer">
                    <input type="radio" name={`q${i}`} className="mt-0.5" />
                    <span>{q}</span>
                  </label>
                ))}
              </div>
              <Button onClick={next}>Save & Continue</Button>
            </div>
          )}
        </Card>
      )}

      {/* Stage 5 — Bank & Tax */}
      {step === 4 && (
        <Card title="Stage 5 — Bank & Tax">
          <div className="flex flex-col gap-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-0.5">Bank Account (penny-drop verified)</p>
              <p className="font-mono text-sm font-semibold text-gray-900">••••{mockData.S10.investor.bank_account_last4}</p>
            </div>
            <FormField label="Nominee Name" id="nominee" placeholder="Full legal name of nominee" />
            <label className="flex gap-3 items-start text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" className="mt-0.5" />
              <span>I declare that I am not a US person and confirm FATCA compliance.</span>
            </label>
            <Button onClick={next}>Submit</Button>
          </div>
        </Card>
      )}

      {/* Stage 6 — Approval Pending */}
      {step === 5 && (
        <Card title="Stage 6 — Approval Pending">
          <div className="text-center py-8">
            <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">⏳</div>
            <p className="text-sm text-gray-700">Your file is under review by our Compliance team.</p>
            {/* TBD: Show SLA estimate? Contact email? */}
            <p className="text-xs text-gray-400 mt-1">Typical SLA: 2–3 business days.</p>
            <div className="mt-4"><StatusBadge label="Under Review" color="amber" /></div>
            <Button className="mt-6" onClick={next}>Simulate: Admin Approves ›</Button>
          </div>
        </Card>
      )}

      {/* Stage 7 — MIA e-Sign */}
      {step === 6 && (
        <Card title="Stage 7 — Master Investment Agreement">
          <div className="text-center py-6">
            <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">📄</div>
            <p className="text-sm text-gray-700 mb-1">Your Master Investment Agreement is ready for e-signature.</p>
            {/* TBD: embedded iframe vs redirect to vendor e-sign page? */}
            <p className="text-xs text-gray-400 mb-6">The signed document will be stored on platform.</p>
            <Button onClick={next}>Review & e-Sign (Mock)</Button>
          </div>
        </Card>
      )}

      {/* Stage 8 — Activated */}
      {step === 7 && (
        <Card>
          <div className="text-center py-6">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">✓</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Account Activated!</h3>
            <p className="text-sm text-gray-500 mb-4">Your investor account is now active. You can browse available listings and start investing.</p>
            <StatusBadge label="Active" color="green" />
            <div className="mt-6">
              <Button onClick={() => navigate('/s11')}>Browse Listings →</Button>
            </div>
          </div>
        </Card>
      )}

      <p className="text-xs text-gray-400 mt-8 leading-relaxed">
        Rules: C20 · DL-008 (invite-gated, 14-day validity) · DL-050 (full KYC stack before activation) · C15 (Aadhaar last4 only) · IA.3 (KYC + MIA + suitability = activation) · C21/G26 (suitability override requires ack)
      </p>
    </div>
  )
}
