import { PERSONAS } from '../../routes.js'

export default function TopBar({ currentPersona, onPersonaChange }) {
  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-indigo-700 text-base tracking-tight">Fintech Platform</span>
        <span className="text-gray-300 text-sm">MVP</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-500">Viewing as</span>
        <select
          value={currentPersona.id}
          onChange={(e) => onPersonaChange(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          {PERSONAS.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
    </header>
  )
}
