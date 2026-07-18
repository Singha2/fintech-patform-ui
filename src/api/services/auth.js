// Auth service — the WS-0 login edge. These three are the only open (no-bearer) routes; they mint the session.
// Two-step: password → challenge_id, then verify OTP → bearer. OTP is SMS in production; in dev the stub
// notifier "sends" it and /dev/last-otp reads it back so the UI can auto-fill it (one-click dev login).
import { request } from '../client.js'
import { IS_DEV_BACKEND } from '../../config.js'

export async function loginPassword(email, password) {
  const { data } = await request('POST', '/auth/login/password', { body: { email, password } })
  return data                                   // { challenge_id }
}

export async function verifyOtp(challengeId, code) {
  const { data } = await request('POST', '/auth/login/verify-otp', { body: { challenge_id: challengeId, code } })
  return data                                   // { bearer }
}

// Dev-only: read back the OTP the stub notifier just "sent", to pre-fill the code. Guarded to dev backend.
export async function devLastOtp(email) {
  if (!IS_DEV_BACKEND) throw new Error('devLastOtp is available only against the dev backend')
  const { data } = await request('GET', `/dev/last-otp?email=${encodeURIComponent(email)}`)
  return data                                   // { email, code }
}
