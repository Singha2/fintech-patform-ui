// E2E BE-18 — passwordless investor login + investor self-commit (own-scoped). The read surface behind the
// investor self-service portal (S1 investor login, S12 self-commit).
import { login, api, seed, cmd, get, check, summary } from './lib.mjs'
const j = o => JSON.stringify(o)

// passwordless investor login: request-otp {email} → /dev/last-otp → verify-otp → bearer
async function loginInvestor(email) {
  const req = await api('POST', '/auth/login/investor/request-otp', { body: { email } })
  if (!req.ok) throw new Error(`request-otp → ${req.status} ${j(req.data)}`)
  const otp = await api('GET', `/dev/last-otp?email=${encodeURIComponent(email)}`)
  const v = await api('POST', '/auth/login/verify-otp', { body: { challenge_id: req.data.challenge_id, code: otp.data.code } })
  if (!v.ok) throw new Error(`verify-otp → ${v.status} ${j(v.data)}`)
  return v.data.bearer
}

console.log('── BE-18 passwordless investor login + self-commit ──')

// 1. passwordless login → investor session
const invBearer = await loginInvestor('investor@dev.local')
check('passwordless login → bearer', !!invBearer)
const sess = await api('GET', '/auth/session', { bearer: invBearer })
check('session kind=investor', sess.data?.kind === 'investor', sess.data?.kind)
const myId = sess.data?.investor_id

// 2. enumeration-safety: unknown / ineligible email still returns a challenge_id-shaped 200
const bogus = await api('POST', '/auth/login/investor/request-otp', { body: { email: 'nope-not-an-investor@example.com' } })
check('request-otp enumeration-safe (200 + challenge_id)', bogus.ok && !!bogus.data?.challenge_id, `${bogus.status}`)

// 3. self-commit to a fresh live listing, own id from session (body = {amount_paise} only)
const s = await seed('live')
const listingId = s.data.listing_id
const before = (await get(`/listings/${listingId}/detail`, invBearer)).data?.committed_total ?? 0
const commit = await cmd(`/listings/${listingId}/subscriptions/commit`, { bearer: invBearer, body: { amount_paise: 1000000 } })
check('investor self-commit 2xx', commit.ok, `${commit.status} ${commit.data?.error_code ?? ''}`)
const after = (await get(`/listings/${listingId}/detail`, invBearer)).data?.committed_total ?? 0
check('committed_total increased', after === before + 1000000, `${before} → ${after}`)

// subscription lands in the investor's OWN portfolio
const port = await get(`/investors/${myId}/subscriptions`, invBearer)
check('subscription in own portfolio', port.data?.rows?.some(r => r.listing_id === listingId), `rows=${port.data?.rows?.length}`)

// 4. cross-tenant write: investor passing a DIFFERENT investor_id → rejected
const s2 = await seed('live')
const xTenant = await cmd(`/listings/${s2.data.listing_id}/subscriptions/commit`, { bearer: invBearer, body: { investor_id: '00000000-0000-0000-0000-000000000009', amount_paise: 1000000 } })
check('cross-tenant self-commit rejected', !xTenant.ok, `${xTenant.status} ${xTenant.data?.error_code ?? ''}`)

// 5. no regression: ops-on-behalf commit still works (admin passes investor_id)
const ops = await login('ops@dev.local')
const s3 = await seed('live')
const onBehalf = await cmd(`/listings/${s3.data.listing_id}/subscriptions/commit`, { bearer: ops, body: { investor_id: myId, amount_paise: 1000000 } })
check('ops-on-behalf commit still 2xx', onBehalf.ok, `${onBehalf.status} ${onBehalf.data?.error_code ?? ''}`)

process.exit(summary() ? 0 : 1)
