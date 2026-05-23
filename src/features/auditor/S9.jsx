import { useState, useMemo } from 'react'
import Card from '../../components/kit/Card.jsx'
import Button from '../../components/kit/Button.jsx'
import PageHeader from '../../components/kit/PageHeader.jsx'
import StatusBadge from '../../components/kit/StatusBadge.jsx'
import { formatDatetime, formatDate } from '../../utils/format.js'
import mockData from '../../data/mockData.js'

const SENS_COLOR = { standard: 'gray', sensitive: 'amber', restricted: 'red' }
const EVENT_TYPES = ['All', ...new Set(mockData.S9.events.map(e => e.event_type))]

export default function S9() {
  const { events, scope } = mockData.S9
  const [filterType, setFilterType] = useState('All')
  const [filterActor, setFilterActor] = useState('')
  const [filterSens, setFilterSens]   = useState('All')
  const [expandedId, setExpandedId]   = useState(null)
  const [exported, setExported]       = useState(false)

  const filtered = useMemo(() => events.filter(e => {
    if (filterType !== 'All' && e.event_type !== filterType) return false
    if (filterActor && !e.actor.toLowerCase().includes(filterActor.toLowerCase())) return false
    if (filterSens !== 'All' && e.sensitivity !== filterSens) return false
    return true
  }), [events, filterType, filterActor, filterSens])

  return (
    <div>
      <PageHeader
        title="Audit Log"
        subtitle={`Scope: ${formatDate(scope.date_range.from)} – ${formatDate(scope.date_range.to)} · Sensitivity: ${scope.sensitivity_level}`}
      />

      {/* Auditor notice */}
      <div className="mb-5 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
        ℹ Your activity on this screen is itself logged (C3). This view is read-only — no operational access (C19/X16 · DL-039).
      </div>

      {/* Scope summary */}
      <Card title="Engagement Scope (DL-039 — time-bound, just-in-time)" className="mb-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div><p className="text-xs text-gray-400">Date Range</p><p className="font-medium">{formatDate(scope.date_range.from)} – {formatDate(scope.date_range.to)}</p></div>
          <div><p className="text-xs text-gray-400">Entity Types</p><p className="font-medium">{scope.entity_types.join(', ')}</p></div>
          <div><p className="text-xs text-gray-400">Sensitivity Level</p><StatusBadge label={scope.sensitivity_level} color={SENS_COLOR[scope.sensitivity_level] ?? 'gray'} /></div>
          <div><p className="text-xs text-gray-400">Scope ID</p><p className="font-mono text-xs text-gray-600">{scope.scope_id}</p></div>
        </div>
      </Card>

      {/* Filter bar */}
      <div className="flex gap-3 flex-wrap items-center mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Event type:</span>
          <select className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 focus:outline-none"
            value={filterType} onChange={e => setFilterType(e.target.value)}>
            {EVENT_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Actor:</span>
          <input className="rounded-md border border-gray-200 px-2 py-1 text-xs w-36 focus:outline-none"
            placeholder="Search actor…" value={filterActor} onChange={e => setFilterActor(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Sensitivity:</span>
          <select className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 focus:outline-none"
            value={filterSens} onChange={e => setFilterSens(e.target.value)}>
            {['All', 'standard', 'sensitive', 'restricted'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-400">{filtered.length} events</span>
          <Button variant="ghost" className="text-xs py-1" disabled={exported}
            onClick={() => setExported(true)}>
            {exported ? 'Rate limit reached (C19/DL-041)' : 'Export CSV'}
          </Button>
        </div>
      </div>

      {/* Events table */}
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50">
            <tr>{['Timestamp', 'Event Type', 'Actor', 'Target', 'Sensitivity'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">No events match current filters.</td></tr>
            )}
            {filtered.map(evt => (
              <>
                <tr key={evt.event_id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setExpandedId(id => id === evt.event_id ? null : evt.event_id)}>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{formatDatetime(evt.recorded_at)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-800">{evt.event_type}</td>
                  <td className="px-4 py-3 text-gray-700">{evt.actor}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{evt.target}</td>
                  <td className="px-4 py-3"><StatusBadge label={evt.sensitivity} color={SENS_COLOR[evt.sensitivity] ?? 'gray'} /></td>
                </tr>
                {expandedId === evt.event_id && (
                  <tr key={`${evt.event_id}-exp`}>
                    <td colSpan={5} className="px-6 py-4 bg-gray-50 border-l-4 border-indigo-400">
                      <p className="text-xs font-semibold text-gray-600 mb-2">Event Detail (read-only · DL-040 — immutable)</p>
                      <pre className="text-xs text-gray-700 bg-white rounded-lg p-3 border border-gray-200 overflow-x-auto">
{JSON.stringify(evt, null, 2)}
                      </pre>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 mt-4">Rules: DL-039 (time-bound scope) · DL-040 (immutable log) · DL-041 (export rate limit) · C3 (auditor reads are logged) · C19/X16 (no operational access)</p>
    </div>
  )
}
