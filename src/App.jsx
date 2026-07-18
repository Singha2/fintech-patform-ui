import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { PERSONAS, SCREENS, LOGIN_PERSONA_MAP } from './routes.js'
import { PlatformStoreProvider } from './store/PlatformStore.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { PersonaProvider, usePersona } from './context/PersonaContext.jsx'
import Layout from './components/layout/Layout.jsx'
import S1  from './features/admin/S1.jsx'
import S2  from './features/admin/S2.jsx'
import S3  from './features/admin/S3.jsx'
import S4  from './features/admin/S4.jsx'
import S5  from './features/admin/S5.jsx'
import S6  from './features/admin/S6.jsx'
import S7  from './features/admin/S7.jsx'
import S8  from './features/admin/S8.jsx'
import S9  from './features/auditor/S9.jsx'
import S10 from './features/investor/S10.jsx'
import S11 from './features/investor/S11.jsx'
import S12 from './features/investor/S12.jsx'
import S13 from './features/investor/S13.jsx'
import S14 from './features/supplier/S14.jsx'
import S15 from './features/buyer/S15.jsx'
import S16 from './features/admin/S16.jsx'

const PAGE_MAP = { S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16 }

function AppRoutes() {
  const { currentPersona, setPersonaById } = usePersona()
  const navigate = useNavigate()

  function handlePersonaChange(personaId) {
    setPersonaById(personaId)
    const next = PERSONAS.find(p => p.id === personaId)
    if (!next) return
    const first = SCREENS.find(s => next.accessibleScreens.includes(s.id))
    if (first) navigate(first.path)
  }

  function handleLogin(personaId) {
    // Accepts either a routes persona id directly (live login, derived from the dev-account email) or a mock
    // S1 login id (founder/ops_lead/…) which maps through LOGIN_PERSONA_MAP.
    const routesPersonaId = PERSONAS.some(p => p.id === personaId)
      ? personaId
      : (LOGIN_PERSONA_MAP[personaId] ?? 'ops-executive')
    setPersonaById(routesPersonaId)
    const landing = routesPersonaId === 'auditor' ? '/s9'
      : routesPersonaId === 'investor' ? '/s11'   // investors land on the marketplace, not onboarding
      : '/s2'
    navigate(landing)
  }

  return (
    <Routes>
      {/* S1 stands alone — no sidebar / topbar */}
      <Route path="/s1" element={<S1 onLogin={handleLogin} />} />

      {/* S15 stands alone — buyer OTP portal, own minimal top bar, no sidebar */}
      <Route path="/s15" element={<S15 />} />

      {/* All other screens inside the Layout shell */}
      <Route element={<Layout currentPersona={currentPersona} onPersonaChange={handlePersonaChange} />}>
        {SCREENS.filter(s => s.id !== 'S1' && s.id !== 'S15').map(screen => {
          const Page = PAGE_MAP[screen.id]
          return <Route key={screen.id} path={screen.path} element={<Page />} />
        })}
        <Route path="/" element={<Navigate to="/s1" replace />} />
        <Route path="*" element={<Navigate to="/s1" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <PlatformStoreProvider>
      <AuthProvider>
        <PersonaProvider>
          <AppRoutes />
        </PersonaProvider>
      </AuthProvider>
    </PlatformStoreProvider>
  )
}
