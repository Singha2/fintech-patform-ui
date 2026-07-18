// BC2 Subscriptions — commit is ops-on-behalf today (pass investor_id); investor self-commit lands with BE-18.
// Paths per API_CATALOGUE.md; shapes per API_ALIGNMENT §2.
import { postCommand, readById } from '../envelope.js'

export const subscriptions = {
  // ── commands ──
  commit:       (listingId, body) => postCommand(`/listings/${listingId}/subscriptions/commit`, body),      // {investor_id,amount_paise}
  cancel:       (subId, v) => postCommand(`/subscriptions/${subId}/cancel`, undefined, { aggregateVersion: v }),
  recordRefund: (subId, v) => postCommand(`/subscriptions/${subId}/record-refund`, undefined, { aggregateVersion: v }),
  // ── reads ──
  get: (listingId, subId) => readById(`/listings/${listingId}/subscriptions/${subId}`),  // {subscription_id,status,amount,aggregate_version}
}
