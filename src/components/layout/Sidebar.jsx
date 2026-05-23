import { NavLink } from 'react-router-dom'
import { SCREENS, SIDEBAR_GROUPS } from '../../routes.js'

export default function Sidebar({ currentPersona }) {
  const accessible = new Set(currentPersona.accessibleScreens)

  return (
    <nav className="w-60 flex-shrink-0 bg-gray-900 text-gray-100 flex flex-col overflow-y-auto">
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
  )
}
