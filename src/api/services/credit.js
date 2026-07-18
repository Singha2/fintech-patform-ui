// BC3 Credit — pricing bands + buyer/supplier credit profiles (S4). Paths per API_CATALOGUE.md.
import { postCommand, readById } from '../envelope.js'

export const credit = {
  // ── commands ──
  pricingBand:     (body)     => postCommand('/credit/pricing-bands', body),               // {buyer_id,tenor_bucket,rate_range_min_bps,rate_range_max_bps,fee_bps,effective_from?}
  buyerProfile:    (id, body) => postCommand(`/credit/buyers/${id}/profile`, body),        // {sector,rating_source,rating,credit_limit_paise,tenor_cap_days}
  supplierProfile: (id, body) => postCommand(`/credit/suppliers/${id}/profile`, body),     // {risk_rating,exposure_cap_paise}
  // ── reads ──
  pricingBands: (buyerId) => readById(`/credit/buyers/${buyerId}/pricing-bands`),          // BE-5 bands (S4)
}
