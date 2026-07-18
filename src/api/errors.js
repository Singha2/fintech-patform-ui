// Helpers for classifying an ApiError. The backend tags every non-success with one of nine B4 error_category
// values; screens dispatch on these rather than raw status codes. (Categories: auth_failure,
// mfa_missing_or_expired, role_not_authorised, maker_checker_violation, version_conflict, idempotency_conflict,
// invariant_violation, bad_request, not_found, internal.)
import { ApiError } from './client.js'

export const isApiError = (e) => e instanceof ApiError

// Optimistic-concurrency / idempotency clash — the caller re-reads the aggregate and retries with a fresh version.
export const isConflict = (e) => isApiError(e) &&
  (e.status === 409 || e.error_category === 'version_conflict' || e.error_category === 'idempotency_conflict')

// Not allowed — wrong role or a maker-checker (checker = maker) violation.
export const isForbidden = (e) => isApiError(e) &&
  (e.status === 403 || e.error_category === 'role_not_authorised' || e.error_category === 'maker_checker_violation')

// Bad input / broken invariant — surface the message next to the offending field.
export const isValidation = (e) => isApiError(e) &&
  (e.status === 400 || e.status === 422 || e.error_category === 'invariant_violation' || e.error_category === 'bad_request')

// Login / bearer / MFA-freshness failure — send the user back to login or re-MFA.
export const isAuthFailure = (e) => isApiError(e) &&
  (e.status === 401 || e.error_category === 'auth_failure' || e.error_category === 'mfa_missing_or_expired')

// A short user-facing string, with the correlation id for support/debugging when present.
export function describe(e) {
  if (!isApiError(e)) return e?.message || 'Something went wrong.'
  const base = e.message || e.error_code || `HTTP ${e.status}`
  return e.correlation_id ? `${base} (ref: ${e.correlation_id})` : base
}
