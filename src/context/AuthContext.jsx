// Session state for live mode: the two-step login (password → OTP), the bearer, and logout. It syncs the bearer
// into the API client (module-level) and sessionStorage (survives refresh, dies on tab close — fine for a mock).
// In mock mode it's an inert shim: S1 keeps its variant switcher + persona dropdown and never calls beginLogin,
// so the offline path is untouched.
import { createContext, useContext, useState, useEffect } from 'react'
import { IS_LIVE } from '../config.js'
import { setBearer } from '../api/client.js'
import { loginPassword, verifyOtp } from '../api/services/auth.js'

const AuthCtx = createContext(null)
export function useAuth() { return useContext(AuthCtx) }

const STORAGE_KEY = 'auth'
function loadPersisted() {
  if (!IS_LIVE) return null
  try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null') } catch { return null }
}

export function AuthProvider({ children }) {
  const persisted = loadPersisted()
  const [bearer, setBearerState] = useState(persisted?.bearer ?? null)
  const [email, setEmail] = useState(persisted?.email ?? '')
  const [loginStep, setLoginStep] = useState('credentials')  // 'credentials' | 'mfa'
  const [challengeId, setChallengeId] = useState(null)

  // Keep the API client's bearer + sessionStorage in sync with state.
  useEffect(() => {
    setBearer(bearer)
    if (!IS_LIVE) return
    if (bearer) sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ bearer, email }))
    else sessionStorage.removeItem(STORAGE_KEY)
  }, [bearer, email])

  async function beginLogin(inputEmail, password) {
    const { challenge_id } = await loginPassword(inputEmail, password)
    setEmail(inputEmail)
    setChallengeId(challenge_id)
    setLoginStep('mfa')
    return challenge_id
  }

  async function completeLogin(code) {
    const { bearer: token } = await verifyOtp(challengeId, code)
    setBearerState(token)
    setLoginStep('credentials')
    setChallengeId(null)
    return token
  }

  function logout() {
    setBearerState(null)
    setChallengeId(null)
    setLoginStep('credentials')
  }

  const value = { bearer, email, loginStep, challengeId, isAuthenticated: !!bearer, beginLogin, completeLogin, logout }
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}
