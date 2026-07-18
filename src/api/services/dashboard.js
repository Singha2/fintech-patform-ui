// Admin dashboard reads (S2) — work-queues + stats (BE-12). Paths per API_CATALOGUE.md.
import { readById } from '../envelope.js'

export const dashboard = {
  workQueues: () => readById('/admin/work-queues'),
  stats:      () => readById('/admin/stats'),   // {active_listings,total_deployed_paise,investors_active,suppliers_active,pending_disbursements}
}
