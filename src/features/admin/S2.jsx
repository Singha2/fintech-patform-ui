import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePersona } from '../../context/PersonaContext.jsx'
import { PERSONA_ROLES, QUEUE_SCREEN, QUEUE_NAME_SCREEN } from '../../routes.js'
import Button from '../../components/kit/Button.jsx'
import Card from '../../components/kit/Card.jsx'
import PageHeader from '../../components/kit/PageHeader.jsx'
import StatusBadge from '../../components/kit/StatusBadge.jsx'
import Table from '../../components/kit/Table.jsx'
import { formatPaise } from '../../utils/format.js'
import mockData from '../../data/mockData.js'
import { IS_LIVE } from '../../config.js'
import { useStore } from '../../store/PlatformStore.jsx'
import { useHydrate } from '../../store/useHydrate.js'

const STATUS_COLOR = { pending: 'amber', in_progress: 'amber', ready: 'green', resolved: 'gray' }

export default function S2() {
  const navigate = useNavigate()
  const { currentPersona } = usePersona()
  const { liveStats, liveQueues } = useStore()
  const live = useHydrate('dashboard')          // live: GET /admin/stats + /admin/work-queues (BE-12)
  const [mfaStale, setMfaStale] = useState(false)

  const roles = PERSONA_ROLES[currentPersona.id] ?? []
  const isSuper = roles.includes('super_admin')

  // Stats — keys match 1:1 between mockData.S2.stats and BE-12 /admin/stats.
  const stats = (IS_LIVE ? liveStats() : mockData.S2.stats) ?? {}
  const summaryCards = [
    { label: 'Active Listings',       value: stats.active_listings ?? '—' },
    { label: 'Total Deployed',        value: stats.total_deployed_paise != null ? formatPaise(stats.total_deployed_paise) : '—' },
    { label: 'Active Investors',      value: stats.investors_active ?? '—' },
    { label: 'Pending Disbursements', value: stats.pending_disbursements ?? '—' },
  ]

  // Work queue — mock: per-item rows (clickable to the item's screen). Live (BE-12): counts per queue/role
  // (no per-item detail), each row still navigates to the relevant screen.
  let columns, items
  if (IS_LIVE) {
    items = (liveQueues() ?? []).filter(q => isSuper || roles.includes(q.role))
    columns = [
      { key: 'queue',  label: 'Queue',   render: row => <span className="text-sm text-gray-800">{row.queue.replace(/_/g, ' ')}</span> },
      { key: 'role',   label: 'Role',    render: row => <span className="font-mono text-xs text-gray-500">{row.role}</span> },
      { key: 'count',  label: 'Pending', render: row => <StatusBadge label={String(row.count)} color={row.count > 0 ? 'amber' : 'gray'} /> },
      { key: 'action', label: '',        render: row => (
        <Button variant="ghost" className="text-xs py-1 px-3" onClick={() => navigate(QUEUE_NAME_SCREEN[row.queue] ?? '/s2')}>Open →</Button>
      )},
    ]
  } else {
    const rawItems = isSuper
      ? Object.values(mockData.S2.queues).flat()
      : roles.flatMap(r => mockData.S2.queues[r] ?? [])
    items = [...new Map(rawItems.map(i => [i.id, i])).values()]
    columns = [
      { key: 'type',  label: 'Type',        render: row => <span className="font-mono text-xs text-gray-500">{row.type}</span> },
      { key: 'label', label: 'Description', render: row => <span className="text-sm text-gray-800">{row.label}</span> },
      { key: 'status', label: 'Status',     render: row => <StatusBadge label={row.status.replace('_', ' ')} color={STATUS_COLOR[row.status] ?? 'gray'} /> },
      { key: 'age_days', label: 'Age',      render: row => <span className="text-xs text-gray-500">{row.age_days}d</span> },
      { key: 'action', label: '',           render: row => (
        <Button variant="ghost" className="text-xs py-1 px-3" onClick={() => navigate(QUEUE_SCREEN[row.type] ?? '/s2')}>Review →</Button>
      )},
    ]
  }

  return (
    <div>
      <PageHeader
        title={`Good morning · ${currentPersona.name}`}
        subtitle={roles.length ? `Roles: ${roles.join(', ')}` : 'No operational roles assigned'}
      />

      {live.error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">Live load failed: {live.error}</div>}
      {live.loading && <p className="text-xs text-gray-400 mb-4">Loading dashboard…</p>}

      {/* MFA stale banner (demo toggle) */}
      <div className="flex items-center gap-2 mb-4">
        <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
          <input type="checkbox" checked={mfaStale} onChange={e => setMfaStale(e.target.checked)} />
          Preview: MFA stale banner
        </label>
      </div>
      {mfaStale && (
        <div className="mb-5 p-3 bg-amber-50 border border-amber-200 rounded-xl flex gap-2 items-center text-sm text-amber-800">
          <span>⚠</span>
          <span>MFA assertion expires in 5 min. Re-verify before sensitive actions (AU10.2).</span>
          <Button variant="ghost" className="ml-auto text-xs py-1">Re-verify</Button>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {summaryCards.map(c => (
          <Card key={c.label} className="py-4">
            <p className="text-xs text-gray-400 mb-1">{c.label}</p>
            <p className="text-xl font-bold text-gray-900">{c.value}</p>
          </Card>
        ))}
      </div>

      {/* Work queue */}
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Work Queue</h2>
      {items.length === 0 ? (
        <Card><p className="text-center text-gray-400 py-10 text-sm">No items pending for your role.</p></Card>
      ) : (
        <Table columns={columns} rows={items} />
      )}
      <p className="text-xs text-gray-400 mt-2">Rules: G19/X14 (tenant-scoped items) · C4 (maker name shown for checker awareness)</p>
    </div>
  )
}
