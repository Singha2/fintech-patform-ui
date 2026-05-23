import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePersona } from '../../context/PersonaContext.jsx'
import Button from '../../components/kit/Button.jsx'
import Card from '../../components/kit/Card.jsx'
import FormField from '../../components/kit/FormField.jsx'
import PageHeader from '../../components/kit/PageHeader.jsx'
import StatusBadge from '../../components/kit/StatusBadge.jsx'
import Table from '../../components/kit/Table.jsx'
import { formatDate } from '../../utils/format.js'
import mockData from '../../data/mockData.js'

const STATUS_COLOR = { pending: 'amber', consumed: 'green', expired: 'gray', revoked: 'red' }

function addDays(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

export default function S8() {
  const navigate = useNavigate()
  const { currentPersona } = usePersona()
  const [invites, setInvites] = useState(mockData.S8.invites)
  const [form, setForm]       = useState({ email: '', phone: '', justification: '', referrer: '' })
  const [successMsg, setSuccessMsg] = useState('')

  const isCompliance = currentPersona.id === 'compliance-reviewer'

  function handleIssue() {
    if (!form.email || !form.phone || !form.justification) return
    const newInvite = {
      invite_id: `inv-i-${Date.now()}`,
      email_display: form.email,
      phone_display: form.phone,
      issued_by: currentPersona.name,
      issued_at: new Date().toISOString(),
      expiry_at: addDays(14),
      status: 'pending',
      consumed_at: null,
      justification: form.justification,
      referrer: form.referrer,
    }
    setInvites(prev => [newInvite, ...prev])
    setSuccessMsg(`Invite sent to ${form.email}. Expires ${formatDate(newInvite.expiry_at)}.`)
    setForm({ email: '', phone: '', justification: '', referrer: '' })
    setTimeout(() => setSuccessMsg(''), 5000)
  }

  function revokeInvite(id) {
    setInvites(prev => prev.map(i => i.invite_id === id ? { ...i, status: 'revoked' } : i))
  }

  const columns = [
    { key: 'email_display',  label: 'Email' },
    { key: 'phone_display',  label: 'Phone' },
    { key: 'issued_by',      label: 'Issued By' },
    { key: 'issued_at',      label: 'Issued',   render: row => formatDate(row.issued_at) },
    { key: 'expiry_at',      label: 'Expires',  render: row => formatDate(row.expiry_at) },
    { key: 'status',         label: 'Status',   render: row => <StatusBadge label={row.status} color={STATUS_COLOR[row.status] ?? 'gray'} /> },
    { key: 'consumed_at',    label: 'Consumed', render: row => row.consumed_at ? formatDate(row.consumed_at) : '—' },
    { key: 'action',         label: '',         render: row => row.status === 'pending'
        ? <Button variant="ghost" className="text-xs py-1 px-3 text-red-600 border-red-200" onClick={() => revokeInvite(row.invite_id)}>Revoke</Button>
        : null
    },
  ]

  return (
    <div>
      <PageHeader title="Investor Invite Issuance" subtitle="Compliance Reviewer — issue single-use 14-day invite codes" />

      {!isCompliance && (
        <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          ⛔ Only Compliance Reviewer can issue invites (DL-036 / I.1). Switch persona to enable the form.
        </div>
      )}

      {successMsg && (
        <div className="mb-5 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
          ✓ {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-1">
          <Card title="Issue New Invite" subtitle="14-day validity · DL-008/I.3 · Logged with justification (C20)">
            <div className="flex flex-col gap-4">
              <FormField label="Invitee Email" id="email" type="email" placeholder="investor@example.com"
                value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} disabled={!isCompliance} />
              <FormField label="Phone (E.164)" id="phone" type="tel" placeholder="+91 98765 43210"
                value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} disabled={!isCompliance} />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Justification <span className="text-red-500">*</span></label>
                <textarea rows={3} placeholder="Required — logged with invite (DL-036)"
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm resize-none focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400"
                  value={form.justification} onChange={e => setForm(f => ({ ...f, justification: e.target.value }))}
                  disabled={!isCompliance} />
              </div>
              <FormField label="Referrer (optional)" id="referrer" placeholder="Name of referring investor"
                value={form.referrer} onChange={e => setForm(f => ({ ...f, referrer: e.target.value }))} disabled={!isCompliance} />
              <Button onClick={handleIssue} disabled={!isCompliance || !form.email || !form.phone || !form.justification}>
                Issue Invite
              </Button>
              {/* TBD: Does platform auto-send invite via email+SMS or does Compliance Reviewer copy/share link? */}
              <p className="text-xs text-gray-400">G9: Invite tied to invitee email + phone at issuance time.</p>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Invite Log (C20)</h2>
          <Table columns={columns} rows={invites} />
        </div>
      </div>

      <Button variant="ghost" className="text-sm" onClick={() => navigate('/s2')}>← Back to Dashboard</Button>
      <p className="text-xs text-gray-400 mt-2">Rules: DL-036/I.1 (Compliance only) · DL-008/I.3 (14-day validity) · C20 (email_hash, phone_hash, justification logged) · G9 (tied to invitee identity)</p>
    </div>
  )
}
