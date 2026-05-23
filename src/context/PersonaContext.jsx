import { createContext, useContext, useState } from 'react'
import { PERSONAS } from '../routes.js'

const PersonaCtx = createContext(null)

export function usePersona() {
  return useContext(PersonaCtx)
}

export function PersonaProvider({ children }) {
  const [currentPersona, setCurrentPersona] = useState(PERSONAS[0])

  function setPersonaById(id) {
    const p = PERSONAS.find(p => p.id === id)
    if (p) setCurrentPersona(p)
  }

  return (
    <PersonaCtx.Provider value={{ currentPersona, setCurrentPersona, setPersonaById }}>
      {children}
    </PersonaCtx.Provider>
  )
}
