// E2E DL-BE-089 — POST /auth/logout revokes the session server-side (bearer dies), for admin + investor.
import { login, api, check, summary } from './lib.mjs'
const j = o => JSON.stringify(o)

// passwordless investor login (BE-18) → bearer
async function loginInvestor(email) {
  const req = await api('POST', '/auth/login/investor/request-otp', { body: { email } })
  const otp = await api('GET', `/dev/last-otp?email=${encodeURIComponent(email)}`)
  const v = await api('POST', '/auth/login/verify-otp', { body: { challenge_id: req.data.challenge_id, code: otp.data.code } })
  return v.data.bearer
}

async function verifyLogout(label, bearer) {
  // bearer is live before logout
  const before = await api('GET', '/auth/session', { bearer })
  check(`${label}: session live before logout`, before.status === 200, `${before.status} ${before.data?.kind ?? ''}`)

  // logout → 204
  const out = await api('POST', '/auth/logout', { bearer })
  check(`${label}: POST /auth/logout → 204`, out.status === 204, `${out.status} ${j(out.data)}`)

  // same bearer is now dead → 401 on a protected read
  const after = await api('GET', '/auth/session', { bearer })
  check(`${label}: bearer 401s after logout`, after.status === 401, `${after.status} ${after.data?.error_code ?? ''}`)

  // idempotent: logging out an already-revoked bearer doesn't 500
  const again = await api('POST', '/auth/logout', { bearer })
  check(`${label}: idempotent second logout (no 5xx)`, again.status < 500, `${again.status}`)
}

console.log('── DL-BE-089 server-side logout ──')
await verifyLogout('admin (ops@)', await login('ops@dev.local'))
await verifyLogout('investor', await loginInvestor('investor@dev.local'))

// a fresh login after logout still works (login path unaffected)
const fresh = await api('GET', '/auth/session', { bearer: await login('ops@dev.local') })
check('re-login after logout works', fresh.status === 200, `${fresh.status}`)

process.exit(summary() ? 0 : 1)
