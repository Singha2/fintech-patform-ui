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
    return { state, mode: DATA_MODE, ...selectors, ...operations }
  }, [state])

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

export function useStore() {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('useStore must be used within <PlatformStoreProvider>')
  return ctx
}
