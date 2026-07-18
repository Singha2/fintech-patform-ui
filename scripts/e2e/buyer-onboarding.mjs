// E2E buyer onboarding chain (BC9, S4) — CREDIT (nominate + credit-assess) + OPS (identity/engagement/
// ack-user/payment/activate). Activation needs ≥1 active ack user + a confirmed payment instruction (BA.3).
import { login, cmd, get, check, summary } from './lib.mjs'
const j = o => JSON.stringify(o)
const VERS = async (id, b) => (await get(`/buyers/${id}`, b)).data?.aggregate_version

const ops = await login('ops@dev.local')
const credit = await login('credit@dev.local')

// unique identifiers per run
const n = process.hrtime.bigint() % 1000000n
const d4 = String(n % 10000n).padStart(4, '0')
const L = String.fromCharCode(65 + Number((n / 10000n) % 26n))
const gstin = `29AABC${L}${d4}Z1Z5`.slice(0, 15)
const cin = `U65999KA2016PTC${String(n).padStart(6, '0')}`

console.log('── Buyer onboarding chain ──')
const nominate = await cmd('/buyers/nominate', { bearer: credit, body: {
  legal_name: `Test Buyer ${n}`, mca_cin: cin, gstin, sector: 'manufacturing' } })
check('nominate (credit)', nominate.ok, `${nominate.status} ${nominate.data?.error_code ?? j(nominate.data)}`)
const id = nominate.data?.aggregate_id

// SoD: nominate is CREDIT — ops nominating → 403
const wrong = await cmd('/buyers/nominate', { bearer: ops, body: { legal_name: `X ${n}`, mca_cin: `U65999KA2016PTC${String((n + 1n) % 1000000n).padStart(6, '0')}`, gstin: `29AABC${L}${d4}Z2Z5`.slice(0, 15), sector: 'manufacturing' } })
check('nominate as ops → 403', wrong.status === 403, wrong.data?.error_code ?? '')

async function step(name, path, bearer, body) {
  const r = await cmd(`/buyers/${id}${path}`, { bearer, body, version: await VERS(id, bearer) })
  const st = (await get(`/buyers/${id}`, bearer)).data?.status
  check(name, r.ok, `${r.status} ${r.data?.error_code ?? ''} → ${st}`)
  return r
}

await step('record-identity-verified (ops)', '/record-identity-verified', ops)
await step('record-credit-assessment (credit)', '/record-credit-assessment', credit, { credit_limit_paise: 50000000 })
await step('start-engagement (ops)', '/start-engagement', ops)
await step('designate-ack-user (ops)', '/designate-ack-user', ops, { email: `ack${n}@test.local`, phone: `+9199${d4}00000`.slice(0, 13), display_name: 'Test Ack User' })
await step('confirm-payment-instruction (ops)', '/confirm-payment-instruction', ops)
await step('activate (ops)', '/activate', ops)

const finState = (await get(`/buyers/${id}`, ops)).data?.status
check('buyer → active', finState === 'active', finState)
process.exit(summary() ? 0 : 1)
