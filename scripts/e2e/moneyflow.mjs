// E2E money-flow write verification: S12 subscribe, S6 approve-disbursement, S7 maturity + distribution.
// Each write is driven exactly as the UI service module calls it (path + body + version), against a listing
// fast-forwarded by /dev/seed-listing.
import { login, seed, cmd, get, check, summary } from './lib.mjs'

const j = (o) => JSON.stringify(o)

async function s12() {
  console.log('\n── S12 subscribe (stage=live) ──────────────────')
  const s = await seed('live')
  check('seed live', s.ok && s.data.status === 'live', j(s.data))
  const { listing_id, investor_id, funding_target } = s.data
  const ops = await login('ops@dev.local')

  const before = await get(`/listings/${listing_id}/detail`, ops)
  const committedBefore = before.data?.committed_total ?? 0
  const amount = Math.min(1000000, funding_target)   // 10k rupees or target, whichever smaller

  // src/api/services/subscriptions.js → commit(listingId, {investor_id, amount_paise})
  const c = await cmd(`/listings/${listing_id}/subscriptions/commit`, { bearer: ops, body: { investor_id, amount_paise: amount } })
  check('commit 2xx', c.ok, `${c.status} ${j(c.data)}`)
  check('envelope has aggregate_id', !!c.data?.aggregate_id, c.data?.aggregate_id)

  const after = await get(`/listings/${listing_id}/detail`, ops)
  const committedAfter = after.data?.committed_total ?? 0
  check('committed_total increased', committedAfter === committedBefore + amount, `${committedBefore} → ${committedAfter} (+${amount})`)
}

async function s6() {
  console.log('\n── S6 approve-disbursement (stage=disbursable) ──')
  const s = await seed('disbursable', { maker: 'treasury@dev.local' })
  check('seed disbursable', s.ok, j(s.data))
  const { listing_id } = s.data

  // same-maker approve must be rejected (checker ≠ maker); treasury@ was the maker
  const maker = await login('treasury@dev.local')
  const selfApprove = await cmd(`/listings/${listing_id}/disbursement/approve`, { bearer: maker })
  check('same-maker approve rejected', !selfApprove.ok, `${selfApprove.status} ${selfApprove.data?.error_code ?? ''}`)

  // real checker approves → listing flips to disbursed
  const checker = await login('treasury2@dev.local')
  const ap = await cmd(`/listings/${listing_id}/disbursement/approve`, { bearer: checker })
  check('checker approve 2xx', ap.ok, `${ap.status} ${j(ap.data)}`)

  const l = await get(`/listings/${listing_id}`, checker)
  check('listing → disbursed', l.data?.status === 'disbursed', l.data?.status)
  const d = await get(`/listings/${listing_id}/disbursement`, checker)
  check('disbursement executed', ['executed', 'approved'].includes(d.data?.status), j(d.data))
  return listing_id
}

async function s7() {
  console.log('\n── S7 record-maturity (OPS) + distribution (TREASURY) ──')
  // record-maturity needs a disbursed listing; per catalogue it is an ops_executive command
  const FACE = 5000000
  const sd = await seed('disbursed', { amount_paise: FACE })
  check('seed disbursed', sd.ok, j(sd.data))
  const lid = sd.data.listing_id
  const ops = await login('ops@dev.local')

  // SoD guard: treasury cannot record maturity
  const treas = await login('treasury@dev.local')
  const wrongRole = await cmd(`/listings/${lid}/record-maturity`, { bearer: treas, body: { amount_paise: FACE, utr: 'UTRDEV0001' } })
  check('record-maturity as treasury → 403', wrongRole.status === 403, wrongRole.data?.error_code ?? '')

  // src/api/services/settlement.js → recordMaturity(listingId, {amount_paise, utr}) — ops actor; amount = face value
  const rm = await cmd(`/listings/${lid}/record-maturity`, { bearer: ops, body: { amount_paise: FACE, utr: 'UTRDEV0001' } })
  check('record-maturity as ops 2xx', rm.ok, `${rm.status} ${j(rm.data)}`)
  const lm = await get(`/listings/${lid}`, ops)
  check('listing → matured', /matur/.test(lm.data?.status ?? ''), lm.data?.status)

  // distribution: treasury maker drafts, treasury2 checker approves (checker ≠ maker)
  const draft = await cmd(`/listings/${lid}/distribution/draft`, { bearer: treas })
  check('distribution draft (treasury) 2xx', draft.ok, `${draft.status} ${draft.data?.error_code ?? j(draft.data)}`)
  const checker = await login('treasury2@dev.local')
  const appr = await cmd(`/listings/${lid}/distribution/approve`, { bearer: checker })
  check('distribution approve (treasury2) 2xx', appr.ok, `${appr.status} ${j(appr.data)}`)
  const ld = await get(`/listings/${lid}/distribution`, checker)
  check('distribution terminal → distributed', ld.data?.terminal_outcome === 'distributed', j(ld.data))
}

await s12()
await s6()
await s7()
process.exit(summary() ? 0 : 1)
