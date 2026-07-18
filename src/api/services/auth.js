// Auth service — the WS-0 login edge. These three are the only open (no-bearer) routes; they mint the session.
// Two-step: password → challenge_id, then verify OTP → bearer. OTP is SMS in production; in dev the stub
// notifier "sends" it and /dev/last-otp reads it back so the UI can auto-fill it (one-click dev login).
import { request } from '../client.js'
import { IS_DEV_BACKEND } from '../../config.js'

export async function loginPassword(email, password) {
  const { data } = await request('POST', '/auth/login/password', { body: { email, password } })
  return data                                   // { challenge_id }
}

// Passwordless investor login (BE-18): email → OTP for an active investor → challenge_id, then verifyOtp.
// Enumeration-safe: the backend returns a challenge_id-shaped 200 whether or not the email is an eligible investor.
export async function requestInvestorOtp(email) {
  const { data } = await request('POST', '/auth/login/investor/request-otp', { body: { email } })
  return data                                   // { challenge_id }
}

export async function verifyOtp(challengeId, code) {
  const { data } = await request('POST', '/auth/login/verify-otp', { body: { challenge_id: challengeId, code } })
  return data                                   // { bearer }
}

// Who-am-I (BE-1): the current session's identity + scope. Drives investor-scoped reads (S13) + role-nav.
export async function session() {
  const { data } = await request('GET', '/auth/session')
  return data                                   // { kind, roles[], investor_id, admin_user_id, mfa_fresh, … }
}

// Server-side session revoke — terminates the bearer so it 401s on any later request (not just a local clear).
// Pass the bearer explicitly so the caller can drop it from local state first. Best-effort: callers ignore failure
// (an already-expired session, or a backend that hasn't exposed the endpoint yet — the revoke logic exists as
// SessionService.revokeSession; awaiting the POST /auth/logout controller).
export async function logoutSession(bearer) {
  await request('POST', '/auth/logout', { bearer })
}

// Dev-only: read back the OTP the stub notifier just "sent", to pre-fill the code. Guarded to dev backend.
export async function devLastOtp(email) {
  if (!IS_DEV_BACKEND) throw new Error('devLastOtp is available only against the dev backend')
  const { data } = await request('GET', `/dev/last-otp?email=${encodeURIComponent(email)}`)
  return data                                   // { email, code }
}
