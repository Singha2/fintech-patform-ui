// E2E investor portfolio reads (BE-14/BE-17, M10-D) — the read surface behind S13.
// Investor self-login (dev password) → own-scoped portfolio {rows, summary} + tax reads; scoping enforced.
import { login, api, check, summary } from './lib.mjs'
const j = o => JSON.stringify(o)

const invBearer = await login('investor@dev.local')     // M10-D dev-password investor login
const sess = await api('GET', '/auth/session', { bearer: invBearer })
check('auth/session kind=investor', sess.data?.kind === 'investor', sess.data?.kind)
const id = sess.data?.investor_id
check('session carries investor_id', !!id, id)

const port = await api('GET', `/investors/${id}/subscriptions`, { bearer: invBearer })
check('portfolio 200', port.ok, `${port.status}`)
check('portfolio has rows + summary', Array.isArray(port.data?.rows) && !!port.data?.summary, Object.keys(port.data ?? {}).join(','))
const s = port.data?.summary ?? {}
check('summary shape', ['total_deployed_paise', 'total_returned_paise', 'active_positions', 'matured_positions'].every(k => k in s), j(s))
const r = port.data?.rows?.[0] ?? {}
check('row shape', ['subscription_id', 'listing_id', 'amount', 'status', 'buyer_name', 'supplier_name', 'due_date', 'distribution_outcome'].every(k => k in r), Object.keys(r).join(','))

const ded = await api('GET', `/investors/${id}/tax/deductions`, { bearer: invBearer })
check('tax/deductions 200 (array)', ded.ok && Array.isArray(ded.data), `${ded.status}`)
const stm = await api('GET', `/investors/${id}/tax/statements`, { bearer: invBearer })
check('tax/statements 200 (array)', stm.ok && Array.isArray(stm.data), `${stm.status}`)

// own-scoping: an investor reading a different id → 403 cross_tenant_read
const other = await api('GET', '/investors/00000000-0000-0000-0000-000000000009/subscriptions', { bearer: invBearer })
check('cross-tenant read → 403 cross_tenant_read', other.status === 403 && other.data?.error_code === 'cross_tenant_read', `${other.status} ${other.data?.error_code ?? ''}`)

// admin may read any investor's portfolio (the S13-in-dev path, id from /dev/seed-info)
const ops = await login('ops@dev.local')
const adminRead = await api('GET', `/investors/${id}/subscriptions`, { bearer: ops })
check('admin read of investor portfolio → 200', adminRead.ok, `${adminRead.status}`)

process.exit(summary() ? 0 : 1)
