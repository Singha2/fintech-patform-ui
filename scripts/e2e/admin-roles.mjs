// E2E S16 Admin & Roles — super_admin provisions an admin and assigns roles (SoD-checked). Backend: Admin IAM.
import { login, cmd, get, check, summary } from './lib.mjs'
const j = o => JSON.stringify(o)

const superA = await login('super@dev.local')
const ops = await login('ops@dev.local')
const n = (process.hrtime.bigint() % 1000000n).toString()

console.log('── S16 admin provision + role assignment (super_admin) ──')
// provision a fresh role-less admin
const prov = await cmd('/admin-users/provision', { bearer: superA, body: { email: `admin${n}@dev.local`, display_name: `Test Admin ${n}`, phone: `+9199${n.padStart(9, '0').slice(-9)}` } })
check('provision (super) 2xx', prov.ok, `${prov.status} ${prov.data?.error_code ?? j(prov.data)}`)
const id = prov.data?.aggregate_id

// assign a role
const asg = await cmd(`/admin-users/${id}/roles`, { bearer: superA, body: { role: 'ops_executive' } })
check('assign role ops_executive (super) 2xx', asg.ok, `${asg.status} ${asg.data?.error_code ?? ''}`)

// SoD soft-pair without override → 400; with override → 2xx
const sod = await cmd(`/admin-users/${id}/roles`, { bearer: superA, body: { role: 'treasury_and_settlement' } })
check('SoD pair without override → 400 validation_failed', sod.status === 400 && sod.data?.error_code === 'validation_failed', `${sod.status} ${sod.data?.error_code ?? ''}`)
const sodOk = await cmd(`/admin-users/${id}/roles`, { bearer: superA, body: { role: 'treasury_and_settlement', override_reason: 'dual-hat approved for pilot' } })
check('SoD pair with override_reason 2xx', sodOk.ok, `${sodOk.status} ${sodOk.data?.error_code ?? ''}`)

// super-only gate
const wrongProv = await cmd('/admin-users/provision', { bearer: ops, body: { email: `x${n}@dev.local`, display_name: 'X', phone: '+919800000000' } })
check('provision as ops → 403', wrongProv.status === 403, `${wrongProv.status} ${wrongProv.data?.error_code ?? ''}`)
const wrongAsg = await cmd(`/admin-users/${id}/roles`, { bearer: ops, body: { role: 'credit_reviewer' } })
check('assign role as ops → 403', wrongAsg.status === 403, `${wrongAsg.status} ${wrongAsg.data?.error_code ?? ''}`)

const rd = await get(`/admin-users/${id}`, superA)
check('GET admin-user 200', rd.status === 200 && !!rd.data?.admin_user_id, j(rd.data))

process.exit(summary() ? 0 : 1)
