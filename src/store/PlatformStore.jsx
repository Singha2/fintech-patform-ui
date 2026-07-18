// The shared client-side store — the single data seam all screens read/write through (docs/TIER2_SHARED_STORE_PLAN.md).
// Mock mode: an in-memory reducer seeded from mockData. Live mode (later): the same operations delegate to
// src/api/services/* and by-id selectors read live, keeping the projection for the list gaps. Screens call
// useStore() only — never mockData or another screen's state directly.
import { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react'
import mockData from '../data/mockData.js'
import { DATA_MODE } from '../config.js'
import { seedFromMock } from './seed.js'
import { makeSelectors } from './selectors.js'
import { makeOperations } from './operations.js'

const StoreCtx = createContext(null)

// Generic reducer — domain meaning lives in the operations, not here, so the store stays swappable.
function reducer(state, action) {
  switch (action.type) {
    case 'SEED':
      return action.state
    case 'UPSERT': {
      const { collection, id, entity } = action
      return { ...state, [collection]: { ...state[collection], [id]: entity } }
    }
    case 'PATCH': {
      const { collection, id, patch } = action
      const current = state[collection]?.[id] ?? {}
      return { ...state, [collection]: { ...state[collection], [id]: { ...current, ...patch } } }
    }
    case 'APPEND_AUDIT':
      return { ...state, auditEvents: [action.event, ...state.auditEvents] }
    case 'HYDRATE': {
      // Live mode: fetch-into-store on mount. Two modes:
      // - replace (list loaders): the fetched whole collection replaces the seed one (so deletions reflect).
      // - merge (by-id loaders): the fetched entities are upserted INTO each collection, keeping the others.
      if (action.replace) return { ...state, ...action.patch }
      // merge: upsert each entity into its collection, deep at the entity level so a partial patch (e.g. just
      // { check_outcomes }) keeps the entity's other fields.
      const next = { ...state }
      for (const [coll, entities] of Object.entries(action.patch)) {
        if (!entities || typeof entities !== 'object' || Array.isArray(entities) || !next[coll] || typeof next[coll] !== 'object') {
          next[coll] = entities
          continue
        }
        const merged = { ...next[coll] }
        for (const [id, entity] of Object.entries(entities)) {
          merged[id] = merged[id] && typeof merged[id] === 'object' && entity && typeof entity === 'object' && !Array.isArray(entity)
            ? { ...merged[id], ...entity } : entity
        }
        next[coll] = merged
      }
      return next
    }
    default:
      return state
  }
}

export function PlatformStoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => seedFromMock(mockData))

  // Keep a ref so operations read the latest state at call-time (not render-time).
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])

  const value = useMemo(() => {
    const selectors = makeSelectors(state)
    const operations = makeOperations(dispatch, () => stateRef.current)
    // hydrate(patch, replace): merge a live-fetched patch into the store (used by useHydrate on mount in live
    // mode). replace=true swaps whole collections (list loaders); default merges entities by id (by-id loaders).
    const hydrate = (patch, replace = false) => dispatch({ type: 'HYDRATE', patch, replace })
    return { state, mode: DATA_MODE, hydrate, ...selectors, ...operations }
  }, [state])

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

export function useStore() {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('useStore must be used within <PlatformStoreProvider>')
  return ctx
}
