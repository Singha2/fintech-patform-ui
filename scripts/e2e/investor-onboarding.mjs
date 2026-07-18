// E2E investor onboarding chain (BC7) — OPS-driven with COMPLIANCE gates. Discovers the exact order + SoD.
import { login, cmd, get, check, summary } from './lib.mjs'
const j = o => JSON.stringify(o)
const VERS = async (id, b) => (await get(`/investors/${id}`, b)).data?.aggregate_version

const compliance = await login('compliance@dev.local')
const ops = await login('ops@dev.local')

const n = (process.hrtime.bigint() % 1000000n).toString()
const email = `inv${n}@example.com`
const phone = `+919${n.padStart(9, '0').slice(-9)}`

console.log('── Investor onboarding chain ──')
const inv = await cmd('/investor-invites/issue', { bearer: compliance, body: { email, phone } })
check('issue invite (compliance)', inv.ok, `${inv.status} ${j(inv.data)}`)
const inviteId = inv.data?.aggregate_id

const invWrong = await cmd('/investor-invites/issue', { bearer: ops, body: { email: `x${email}`, phone } })
check('issue invite as ops → 403', invWrong.status === 403, invWrong.data?.error_code ?? '')

const su = await cmd('/investors/sign-up', { bearer: ops, body: { invite_id: inviteId, email, phone, sub_type: 'resident_individual' } })
check('sign-up (ops)', su.ok, `${su.status} ${j(su.data)}`)
const id = su.data?.aggregate_id

async function step(name, path, bearer, body) {
  const r = await cmd(`/investors/${id}${path}`, { bearer, body, version: await VERS(id, bearer) })
  check(name, r.ok, `${r.status} ${r.data?.error_code ?? ''} → ${(await get(`/investors/${id}`, bearer)).data?.status}`)
  return r
}

await step('record-identity-verified (ops)', '/record-identity-verified', ops, { pan: 'ABCDE1234F', aadhaar_last4: '1234' })
await step('submit-kyc (ops)', '/submit-kyc', ops)
await step('assess-suitability (compliance)', '/assess-suitability', compliance, { mismatch: false })
await step('complete-financial-profile (ops)', '/complete-financial-profile', ops, { bank_account_last4: '6789' })
await step('record-kyc-approved (compliance)', '/record-kyc-approved', compliance)
await step('record-mia-signed (ops)', '/record-mia-signed', ops)
await step('activate (ops)', '/activate', ops)

const finState = (await get(`/investors/${id}`, ops)).data?.status
check('investor → active', finState === 'active', finState)
process.exit(summary() ? 0 : 1)
