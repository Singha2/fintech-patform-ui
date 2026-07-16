// Runtime config + the data-mode seam (see docs/INTEGRATION_PLAN.md Phase 0, docs/TIER2_SHARED_STORE_PLAN.md).
// The shared store reads DATA_MODE to pick its backing: 'mock' (in-memory, seeded from mockData) or 'live'
// (src/api/services/* + live reads). Default stays 'mock' so the app runs with no backend.
export const API_BASE = '/api/v1'                                       // always relative → Vite dev proxy handles origin
export const DATA_MODE = import.meta.env.VITE_DATA_MODE ?? 'mock'       // 'mock' | 'live'
export const IS_LIVE = DATA_MODE === 'live'
export const IS_DEV_BACKEND = (import.meta.env.VITE_DEV_BACKEND ?? 'true') === 'true'  // enables /dev/last-otp OTP peek in live mode
