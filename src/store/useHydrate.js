// useHydrate(spec, deps) — fetch-into-store on mount, plus a reload() to re-fetch on demand (e.g. after a write:
// POST via the service → reload() to GET the fresh list). In live mode it runs the named loader and merges the
// result into the store, reporting {loading, error, reload}. In mock mode it's a no-op (already seeded), so
// screens behave exactly as before.
//   spec: 'suppliers'            → list loader, no args
//         ['listingDetail', id]  → by-id loader called with (id); re-runs when `deps` change
import { useCallback, useEffect, useState } from 'react'
import { useStore } from './PlatformStore.jsx'
import { IS_LIVE } from '../config.js'
import { liveLoaders } from './live.js'
import { describe } from '../api/errors.js'

export function useHydrate(spec, deps = []) {
  const { hydrate } = useStore()
  const [status, setStatus] = useState({ loading: IS_LIVE, error: null })

  const reload = useCallback(() => {
    if (!IS_LIVE) return Promise.resolve()
    const [key, ...args] = Array.isArray(spec) ? spec : [spec]
    const loader = liveLoaders[key]
    if (!loader) { setStatus({ loading: false, error: `no live loader "${key}"` }); return Promise.resolve() }
    setStatus({ loading: true, error: null })
    return Promise.resolve(loader.load(...args))
      .then((patch) => { hydrate(patch, loader.mode === 'replace'); setStatus({ loading: false, error: null }) })
      .catch((e) => setStatus({ loading: false, error: describe(e) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => { reload() }, [reload])

  return { ...status, reload }
}
