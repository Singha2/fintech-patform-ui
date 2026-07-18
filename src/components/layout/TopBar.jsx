import { useNavigate } from 'react-router-dom'
import { PERSONAS } from '../../routes.js'
import { IS_LIVE } from '../../config.js'
import { useAuth } from '../../context/AuthContext.jsx'

export default function TopBar({ currentPersona, onPersonaChange, onMenuToggle }) {
  const navigate = useNavigate()
  const { isAuthenticated, email, logout } = useAuth()
  function handleLogout() { logout(); navigate('/s1') }
  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6 flex-shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="md:hidden p-1.5 rounded-md text-gray-500 hover:bg-gray-100"
          aria-label="Toggle menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="font-semibold text-indigo-700 text-base tracking-tight">Fintech Platform</span>
        <span className="text-gray-300 text-sm">MVP</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden sm:inline text-xs text-gray-500">Viewing as</span>
        <select
          value={currentPersona.id}
          onChange={(e) => onPersonaChange(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          {PERSONAS.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        {IS_LIVE && isAuthenticated && (
          <>
            {email && <span className="hidden md:inline text-xs text-gray-400" title="Logged-in account">{email}</span>}
            <button
              onClick={handleLogout}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 hover:text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              Log out
            </button>
          </>
        )}
      </div>
    </header>
  )
}
