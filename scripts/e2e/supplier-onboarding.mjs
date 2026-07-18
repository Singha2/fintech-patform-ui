// E2E supplier onboarding chain (BC8, S3) — OPS-driven with COMPLIANCE (KYC) + CREDIT (review) gates.
import { login, cmd, get, check, summary } from './lib.mjs'
const j = o => JSON.stringify(o)
const VERS = async (id, b) => (await get(`/suppliers/${id}`, b)).data?.aggregate_version

const ops = await login('ops@dev.local')
const compliance = await login('compliance@dev.local')
const credit = await login('credit@dev.local')

// unique identifiers per run (a reused PAN/GSTIN/CIN collides)
const n = process.hrtime.bigint() % 1000000n
const d4 = String(n % 10000n).padStart(4, '0')
const L = String.fromCharCode(65 + Number((n / 10000n) % 26n))
const pan = `ABCD${L}${d4}F`
const gstin = `27${pan}1Z5`
const cin = `U74999MH2015PTC${String(n).padStart(6, '0')}`

console.log('── Supplier onboarding chain ──')
const create = await cmd('/suppliers/create', { bearer: ops, body: {
  legal_name: `Test Supplier ${n}`, constitution_type: 'private_limited', pan, gstin, cin } })
check('create (ops)', create.ok, `${create.status} ${create.data?.error_code ?? j(create.data)}`)
const id = create.data?.aggregate_id

// SoD: identity as compliance → 403
const wrong = await cmd(`/suppliers/${id}/record-identity-verified`, { bearer: compliance, version: await VERS(id, compliance) })
check('identity as compliance → 403', wrong.status === 403, wrong.data?.error_code ?? '')

async function step(name, path, bearer, body) {
  const r = await cmd(`/suppliers/${id}${path}`, { bearer, body, version: await VERS(id, bearer) })
  const st = (await get(`/suppliers/${id}`, bearer)).data?.status
  check(name, r.ok, `${r.status} ${r.data?.error_code ?? ''} → ${st}`)
  return r
}

await step('record-identity-verified (ops)', '/record-identity-verified', ops)
await step('submit-kyc (ops)', '/submit-kyc', ops)
await step('record-kyc-approved (compliance)', '/record-kyc-approved', compliance)
await step('submit-financial-profile (ops)', '/submit-financial-profile', ops, { top_buyers: [] })
await step('record-credit-review (credit)', '/record-credit-review', credit, { exposure_cap_paise: 20000000, risk_rating: 'A' })
await step('record-maa-signed (ops)', '/record-maa-signed', ops)
await step('activate (ops)', '/activate', ops)

const finState = (await get(`/suppliers/${id}`, ops)).data?.status
check('supplier → active', finState === 'active', finState)
process.exit(summary() ? 0 : 1)
