// Command-envelope helpers. Every write is a command: it carries an idempotency X-Command-Id (+ an optimistic
// X-Aggregate-Version on transitions) and returns the ENVELOPE { aggregate_id, aggregate_version, emitted_events,
// correlation_id } — NOT the entity. Callers re-read GET …/{id} after a command to get the new state.
import { request } from './client.js'

export function newCommandId() { return crypto.randomUUID() }

// POST a command. Creation commands pass no aggregateVersion; transitions must thread the aggregate's current
// version (from the last envelope or a fresh readById). Returns the envelope.
export async function postCommand(path, body, { bearer, aggregateVersion } = {}) {
  const { data } = await request('POST', path, { body, bearer, commandId: newCommandId(), aggregateVersion })
  return data
}

// PUT a command (the two replace commands: invoice-doc replace, kyc-doc replace). Same envelope contract.
export async function putCommand(path, body, { bearer, aggregateVersion } = {}) {
  const { data } = await request('PUT', path, { body, bearer, commandId: newCommandId(), aggregateVersion })
  return data
}

// Fetch-one-by-id read (the backend's thin read side). Returns the entity JSON.
export async function readById(path, bearer) {
  const { data } = await request('GET', path, { bearer })
  return data
}
