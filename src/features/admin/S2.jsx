import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePersona } from '../../context/PersonaContext.jsx'
import { PERSONA_ROLES, QUEUE_SCREEN, QUEUE_NAME_SCREEN } from '../../routes.js'
import Button from '../../components/kit/Button.jsx'
import Card from '../../components/kit/Card.jsx'
import FormField from '../../components/kit/FormField.jsx'
import PageHeader from '../../components/kit/PageHeader.jsx'
import StatusBadge from '../../components/kit/StatusBadge.jsx'
import Table from '../../components/kit/Table.jsx'
import { formatPaise } from '../../utils/format.js'
import mockData from '../../data/mockData.js'
import { IS_LIVE } from '../../config.js'
import { useStore } from '../../store/PlatformStore.jsx'
import { useHydrate } from '../../store/useHydrate.js'
import { adminUsers as adminUsersSvc } from '../../api/services/index.js'
import { describe } from '../../api/errors.js'

const STATUS_COLOR = { pending: 'amber', in_progress: 'amber', ready: 'green', resolved: 'gray' }

// Admin IAM widget (super-admin only). admin_role wire values ↔ labels.
const ADMIN_ROLES = ['ops_executive', 'credit_reviewer', 'compliance_reviewer', 'treasury_and_settlement', 'super_admin']
const ROLE_LABELS = {
  ops_executive: 'Ops Executive', credit_reviewer: 'Credit Reviewer', compliance_reviewer: 'Compliance Reviewer',
  treasury_and_settlement: 'Treasury & Settlement', super_admin: 'Super Admin',
}

export default function S2() {
  const navigate = useNavigate()
  const { currentPersona } = usePersona()
  const { liveStats, liveQueues } = useStore()
  const live = useHydrate('dashboard')          // live: GET /admin/stats + /admin/work-queues (BE-12)
  const [mfaStale, setMfaStale] = useState(false)

  const roles = PERSONA_ROLES[currentPersona.id] ?? []
  const isSuper = roles.includes('super_admin')

  // ── Admin & Roles widget (super-admin only) ──
  const [pForm, setPForm] = useState({ email: '', display_name: '', phone: '' })
  const [provId, setProvId] = useState('')
  const [pBusy, setPBusy] = useState(false)
  const [pErr, setPErr] = useState('')
  const [aForm, setAForm] = useState({ admin_user_id: '', role: 'ops_executive', override_reason: '' })
  const [aBusy, setABusy] = useState(false)
  const [aErr, setAErr] = useState('')
  const [aMsg, setAMsg] = useState('')
  const pset = k => e => setPForm(f => ({ ...f, [k]: e.target.value }))
  const aset = k => e => setAForm(f => ({ ...f, [k]: e.target.value }))

  // 🔗 POST /admin-users/provision → a role-less 'invited' admin; returns admin_user_id (no list-read to pick from).
  async function provisionAdmin() {
    setPErr(''); setProvId(''); setPBusy(true)
    try {
      const env = await adminUsersSvc.provision({ email: pForm.email.trim(), display_name: pForm.display_name.trim(), phone: pForm.phone.trim() })
      const id = env?.aggregate_id ?? ''
      setProvId(id)
      setAForm(f => ({ ...f, admin_user_id: id }))
      setPForm({ email: '', display_name: '', phone: '' })
    } catch (e) { setPErr(describe(e)) } finally { setPBusy(false) }
  }
  // 🔗 POST /admin-users/{id}/roles {role, override_reason?} — SoD-checked; a soft-pair role 400s asking for a reason.
  async function assignRole() {
    setAErr(''); setAMsg(''); setABusy(true)
    try {
      const body = { role: aForm.role }
      if (aForm.override_reason.trim()) body.override_reason = aForm.override_reason.trim()
      await adminUsersSvc.assignRole(aForm.admin_user_id.trim(), body)
      setAMsg(`Assigned ${ROLE_LABELS[aForm.role]}.`)
      setAForm(f => ({ ...f, override_reason: '' }))
    } catch (e) { setAErr(describe(e)) } finally { setABusy(false) }
  }
  const sodPrompt = /override_reason|soft SoD/i.test(aErr)

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

      {/* ── Admin & Roles (super-admin only; backend enforces super_admin → 403 otherwise) ── */}
      {isSuper && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Admin &amp; Roles <span className="text-xs font-normal text-gray-400">· Super Admin</span></h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card title="Assign a role">
              <div className="flex flex-col gap-3">
                <FormField label="Admin User ID" id="aid" value={aForm.admin_user_id} onChange={aset('admin_user_id')} placeholder="from a provision, or paste an id" />
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Role</label>
                  <select className="rounded-md border border-gray-300 px-3 py-2 text-sm" value={aForm.role} onChange={aset('role')}>
                    {ADMIN_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                </div>
                <FormField label={`Override reason${sodPrompt ? ' (required — SoD pair)' : ' (optional)'}`} id="ovr" value={aForm.override_reason} onChange={aset('override_reason')} placeholder="required only for a soft SoD role pair" />
                <Button disabled={aBusy || !aForm.admin_user_id.trim()} onClick={assignRole}>{aBusy ? 'Assigning…' : 'Assign Role'}</Button>
                {aMsg && <p className="text-xs text-green-600">✓ {aMsg}</p>}
                {aErr && <p className="text-xs text-red-600">Failed: {aErr}</p>}
              </div>
            </Card>
            <Card title="Provision a new admin">
              <div className="flex flex-col gap-3">
                <FormField label="Email" id="pemail" type="email" value={pForm.email} onChange={pset('email')} placeholder="new.admin@company.com" />
                <FormField label="Display name" id="pname" value={pForm.display_name} onChange={pset('display_name')} placeholder="Full name" />
                <FormField label="Phone" id="pphone" type="tel" value={pForm.phone} onChange={pset('phone')} placeholder="+9198…" />
                <Button disabled={pBusy || !pForm.email.trim() || !pForm.display_name.trim() || !pForm.phone.trim()} onClick={provisionAdmin}>{pBusy ? 'Provisioning…' : 'Provision Admin'}</Button>
                {provId && (
                  <div className="p-2 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-xs text-green-800">✓ Provisioned <StatusBadge label="invited" color="gray" /> — role-less until assigned (id filled left).</p>
                    <p className="text-[11px] font-mono text-gray-600 break-all mt-1">{provId}</p>
                  </div>
                )}
                {pErr && <p className="text-xs text-red-600">Failed: {pErr}</p>}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
