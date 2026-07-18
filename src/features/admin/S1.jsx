import { useState } from 'react'
import Button from '../../components/kit/Button.jsx'
import Card from '../../components/kit/Card.jsx'
import FormField from '../../components/kit/FormField.jsx'
import mockData from '../../data/mockData.js'
import { IS_LIVE, IS_DEV_BACKEND } from '../../config.js'
import { personaFromSession } from '../../routes.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { devLastOtp } from '../../api/services/auth.js'
import { describe } from '../../api/errors.js'

const VARIANTS = [
  { id: 'normal',           label: 'Normal' },
  { id: 'mfa_failed',       label: 'MFA Failed' },
  { id: 'account_disabled', label: 'Account Disabled' },
]

// Shared login chrome (logo + title + card), so mock and live look identical.
function LoginShell({ topRight, children }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      {topRight && <div className="fixed top-4 right-4 flex gap-2 z-10">{topRight}</div>}
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-block w-10 h-10 bg-indigo-600 rounded-xl mb-3" />
          <h1 className="text-2xl font-bold text-gray-900">Fintech Platform</h1>
          <p className="text-sm text-gray-400 mt-1">Admin Console</p>
        </div>
        <Card>{children}</Card>
      </div>
    </div>
  )
}

export default function S1({ onLogin }) {
  return IS_LIVE ? <LiveLogin onLogin={onLogin} /> : <MockLogin onLogin={onLogin} />
}

// ── LIVE login: real password → OTP against the backend (DATA_MODE=live) ─────────────────────────────
function LiveLogin({ onLogin }) {
  const { beginLogin, beginInvestorLogin, completeLogin } = useAuth()
  const [mode, setMode]         = useState('admin')            // 'admin' (email+password) | 'investor' (passwordless)
  const [step, setStep]         = useState('credentials')
  const [email, setEmail]       = useState('ops@dev.local')     // dev default; any seeded admin works
  const [password, setPassword] = useState('DevPass123!')
  const [otp, setOtp]           = useState('')
  const [err, setErr]           = useState('')
  const [busy, setBusy]         = useState(false)
  const isInvestor = mode === 'investor'

  function switchMode(next) {
    setMode(next); setErr(''); setOtp('')
    setEmail(next === 'investor' ? 'investor@dev.local' : 'ops@dev.local')
  }

  async function submitCredentials() {
    setErr(''); setBusy(true)
    try {
      if (isInvestor) await beginInvestorLogin(email.trim())    // passwordless: email → OTP (BE-18)
      else await beginLogin(email.trim(), password)
      setStep('mfa')
      if (IS_DEV_BACKEND) {                        // one-click dev login: auto-fill the OTP the stub "sent"
        try { const { code } = await devLastOtp(email.trim()); if (code) setOtp(code) } catch { /* ignore */ }
      }
    } catch (e) { setErr(describe(e)) } finally { setBusy(false) }
  }

  async function submitOtp() {
    setErr(''); setBusy(true)
    try {
      const { session } = await completeLogin(otp.trim())
      onLogin(personaFromSession(session))         // persona from the session's roles/kind — backend enforces real authz
    } catch (e) { setErr(describe(e)) } finally { setBusy(false) }
  }

  return (
    <LoginShell>
      {step === 'credentials' ? (
        <div className="flex flex-col gap-4">
          <FormField label="Email" id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          {!isInvestor && <FormField label="Password" id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} />}
          {err && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{err}</p>}
          <Button onClick={submitCredentials} disabled={busy || !email || (!isInvestor && !password)}>{busy ? 'Signing in…' : isInvestor ? 'Send OTP' : 'Login'}</Button>
          <button className="text-xs text-center text-indigo-600 hover:underline" onClick={() => switchMode(isInvestor ? 'admin' : 'investor')}>
            {isInvestor ? '← Admin login (email + password)' : 'Investor? Log in with email + OTP →'}
          </button>
          <p className="text-xs text-center text-gray-400">{isInvestor ? 'Passwordless investor login (BE-18)' : 'Live mode · seeded dev admins, password DevPass123!'}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600">Enter the OTP sent to <span className="font-medium">{email}</span></p>
          <FormField label="6-digit code" id="otp" placeholder="123456" maxLength={6} value={otp} onChange={e => setOtp(e.target.value)} />
          {IS_DEV_BACKEND && <p className="text-xs text-indigo-600">Dev: OTP auto-filled from /dev/last-otp.</p>}
          {err && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{err}</p>}
          <Button onClick={submitOtp} disabled={busy || otp.trim().length !== 6}>{busy ? 'Verifying…' : 'Verify & Enter'}</Button>
          <button className="text-xs text-indigo-600 hover:underline" onClick={() => { setStep('credentials'); setErr('') }}>← Back</button>
        </div>
      )}
    </LoginShell>
  )
}

// ── MOCK login: the original offline flow — variant switcher + "Login as" persona dropdown (unchanged) ──
function MockLogin({ onLogin }) {
  const [step, setStep]       = useState('credentials') // 'credentials' | 'mfa'
  const [variant, setVariant] = useState('normal')
  const [personaId, setPersonaId] = useState(mockData.S1.personas[0].id)

  const pills = VARIANTS.map(v => (
    <button key={v.id} onClick={() => { setVariant(v.id); setStep('credentials') }}
      className={`px-3 py-1 text-xs rounded-full border transition-colors ${variant === v.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-300 hover:border-indigo-400'}`}>
      {v.label}
    </button>
  ))

  return (
    <LoginShell topRight={pills}>
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
          <p className="text-xs text-center text-gray-400">Forgot password? Contact Super Admin.</p>
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
    </LoginShell>
  )
}
