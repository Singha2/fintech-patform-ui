// Shared harness lib — replicates src/api/client.js + envelope.js + auth.js against the live dev backend.
const BASE = 'http://localhost:8080/api/v1'
export const PW = 'DevPass123!'

export async function api(method, path, { bearer, body, version, commandId } = {}) {
  const headers = {}
  if (bearer) headers['Authorization'] = `Bearer ${bearer}`
  if (commandId) headers['X-Command-Id'] = commandId
  if (version != null) headers['X-Aggregate-Version'] = String(version)
  let payload
  if (body !== undefined) { payload = JSON.stringify(body); headers['Content-Type'] = 'application/json' }
  const res = await fetch(BASE + path, { method, headers, body: payload })
  const ct = res.headers.get('content-type') ?? ''
  const data = ct.includes('application/json') ? await res.json().catch(() => null)
    : res.status === 204 ? null : await res.text()
  return { status: res.status, ok: res.ok, data }
}

export const cmd = (path, opts) => api('POST', path, { ...opts, commandId: crypto.randomUUID() })
export const get = (path, bearer) => api('GET', path, { bearer })

export async function login(email) {
  const p = await api('POST', '/auth/login/password', { body: { email, password: PW } })
  if (!p.ok) throw new Error(`login/password ${email} → ${p.status} ${JSON.stringify(p.data)}`)
  const otp = await api('GET', `/dev/last-otp?email=${encodeURIComponent(email)}`)
  const v = await api('POST', '/auth/login/verify-otp', { body: { challenge_id: p.data.challenge_id, code: otp.data.code } })
  if (!v.ok) throw new Error(`verify-otp ${email} → ${v.status} ${JSON.stringify(v.data)}`)
  return v.data.bearer
}

export const seed = (stage, extra = {}) => cmd('/dev/seed-listing', { body: { stage, ...extra } })

let pass = 0, fail = 0
export function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}${detail ? ' — ' + detail : ''}`) }
  else { fail++; console.log(`  ✗ FAIL ${name}${detail ? ' — ' + detail : ''}`) }
}
export function summary() {
  console.log(`\n${'='.repeat(50)}\nRESULT: ${pass} passed, ${fail} failed`)
  return fail === 0
}
