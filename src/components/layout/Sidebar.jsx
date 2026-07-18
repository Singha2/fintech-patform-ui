import { NavLink } from 'react-router-dom'
import { SCREENS, SIDEBAR_GROUPS, screenIdsForSession } from '../../routes.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { IS_LIVE } from '../../config.js'

export default function Sidebar({ currentPersona, open, onClose }) {
  const { session } = useAuth()
  // Live: screens come straight from the session's roles/kind (no persona). Mock: the selected persona's set.
  const accessible = new Set(IS_LIVE ? screenIdsForSession(session) : currentPersona.accessibleScreens)

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <nav className={`
        fixed inset-y-0 left-0 z-40 w-60 bg-gray-900 text-gray-100 flex flex-col overflow-y-auto
        transform transition-transform duration-200
        ${open ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0 md:flex
      `}>
        {SIDEBAR_GROUPS.map((group) => {
          const screens = SCREENS.filter((s) => s.group === group)
          return (
            <div key={group} className="pt-5 pb-2">
              <p className="px-4 mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                {group}
              </p>
              {screens.map((screen) => {
                const isAccessible = accessible.has(screen.id)
                return isAccessible ? (
                  <NavLink
                    key={screen.id}
                    to={screen.path}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                        isActive
                          ? 'bg-indigo-600 text-white'
                          : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                      }`
                    }
                  >
                    <span className="text-[10px] font-mono text-gray-500 w-6 flex-shrink-0">
                      {screen.id}
                    </span>
                    <span className="truncate">{screen.name}</span>
                  </NavLink>
                ) : (
                  <div
                    key={screen.id}
                    className="flex items-center gap-2 px-4 py-2 text-sm opacity-30 cursor-not-allowed select-none"
                  >
                    <span className="text-[10px] font-mono w-6 flex-shrink-0">{screen.id}</span>
                    <span className="truncate">{screen.name}</span>
                  </div>
                )
              })}
            </div>
          )
        })}
      </nav>
    </>
  )
}
