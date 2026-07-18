// The transport core — the one place that knows the base URL, the bearer, the command-envelope headers, and the
// error shape. Everything above (services, envelope helpers) goes through request(). Screens never call fetch.
import { API_BASE } from '../config.js'

// Module-level bearer the client injects into every authenticated request. AuthContext sets it on login/logout
// (so services don't have to thread it through every call); callers may still pass an explicit bearer to override.
let _bearer = null
export function setBearer(b) { _bearer = b || null }
export function getBearer() { return _bearer }

// The canonical backend error body (B4 §4.1), carried verbatim so screens/agents can dispatch on
// error_code + error_category. Built by the backend's ApiError + the security AuthenticationEntryPoint.
export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message || `HTTP ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.error_code = body?.error_code ?? null
    this.error_category = body?.error_category ?? null
    this.violating_rule = body?.violating_rule ?? null
    this.violating_invariant_id = body?.violating_invariant_id ?? null
    this.correlation_id = body?.correlation_id ?? null
    this.retryable = body?.retryable ?? false
  }
}

// request(method, path, { body, bearer, commandId, aggregateVersion, raw, contentType }) → { status, data, headers }.
// - Authorization: Bearer <token> when a bearer is set (explicit arg wins over the module-level one).
// - X-Command-Id when commandId given; X-Aggregate-Version when aggregateVersion != null.
// - JSON body by default; raw sends the Blob/ArrayBuffer as-is (for PDF upload) with the given contentType.
// - Parses JSON, binary (raw), 204 (null), or text. On !res.ok throws ApiError from the parsed error envelope.
export async function request(method, path, opts = {}) {
  const { body, bearer, commandId, aggregateVersion, raw, contentType } = opts
  const headers = {}
  const token = bearer ?? _bearer
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (commandId) headers['X-Command-Id'] = commandId
  if (aggregateVersion != null) headers['X-Aggregate-Version'] = String(aggregateVersion)

  let payload
  if (raw) {
    payload = body                                  // Blob / ArrayBuffer, sent as-is
    if (contentType) headers['Content-Type'] = contentType
  } else if (body !== undefined) {
    payload = JSON.stringify(body)
    headers['Content-Type'] = contentType ?? 'application/json'
  }

  const res = await fetch(API_BASE + path, { method, headers, body: payload })
  const ct = res.headers.get('content-type') ?? ''
  const isJson = ct.includes('application/json')

  if (!res.ok) {
    const errBody = isJson ? await res.json().catch(() => null) : null
    throw new ApiError(res.status, errBody)
  }

  let data
  if (raw) data = await res.blob()
  else if (isJson) data = await res.json().catch(() => null)
  else if (res.status === 204) data = null
  else data = await res.text()

  return { status: res.status, data, headers: res.headers }
}
