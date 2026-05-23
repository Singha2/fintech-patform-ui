import { useState } from 'react'
import Button from '../../components/kit/Button.jsx'
import Card from '../../components/kit/Card.jsx'
import FormField from '../../components/kit/FormField.jsx'
import mockData from '../../data/mockData.js'

const VARIANTS = [
  { id: 'normal',           label: 'Normal' },
  { id: 'mfa_failed',       label: 'MFA Failed' },
  { id: 'account_disabled', label: 'Account Disabled' },
]

export default function S1({ onLogin }) {
  const [step, setStep]       = useState('credentials') // 'credentials' | 'mfa'
  const [variant, setVariant] = useState('normal')
  const [personaId, setPersonaId] = useState(mockData.S1.personas[0].id)

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      {/* Preview switcher — top-right corner */}
      <div className="fixed top-4 right-4 flex gap-2 z-10">
        {VARIANTS.map(v => (
          <button key={v.id} onClick={() => { setVariant(v.id); setStep('credentials') }}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${variant === v.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-300 hover:border-indigo-400'}`}>
            {v.label}
          </button>
        ))}
      </div>

      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-block w-10 h-10 bg-indigo-600 rounded-xl mb-3" />
          <h1 className="text-2xl font-bold text-gray-900">Fintech Platform</h1>
          <p className="text-sm text-gray-400 mt-1">Admin Console</p>
        </div>

        <Card>
          {variant === 'account_disabled' ? (
            <div className="text-center py-4">
              <p className="font-semibold text-red-700 mb-1">Account Disabled</p>
              <p className="text-sm text-red-600">Contact your Super Admin to reinstate access.</p>
            </div>
          ) : step === 'credentials' ? (
            <div className="flex flex-col gap-4">
              <FormField label="Email" id="email" type="email" defaultValue={mockData.S1.credentials.email} />
              <FormField label="Password" id="password" type="password" defaultValue="••••••••" />
              <Button onClick={() => setStep('mfa')}>Login</Button>
              <p className="text-xs text-center text-gray-400">
                {/* TBD: Forgot password — admin reset or self-service? */}
                Forgot password? Contact Super Admin.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-gray-600">Enter your authenticator code (DL-035)</p>
              <FormField label="6-digit TOTP code" id="totp" placeholder="123456" maxLength={6} defaultValue={mockData.S1.mfa.code} />
              {variant === 'mfa_failed' && (
                <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">Invalid code. 2 attempts remaining.</p>
              )}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Login as <span className="text-gray-400 font-normal">(mock only)</span></label>
                <select className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                  value={personaId} onChange={e => setPersonaId(e.target.value)}>
                  {mockData.S1.personas.map(p => (
                    <option key={p.id} value={p.id}>{p.label} ({p.roles.join(', ')})</option>
                  ))}
                </select>
              </div>
              <Button onClick={() => variant !== 'mfa_failed' && onLogin(personaId)}>
                Verify &amp; Enter
              </Button>
              <button className="text-xs text-indigo-600 hover:underline" onClick={() => setStep('credentials')}>← Back</button>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
