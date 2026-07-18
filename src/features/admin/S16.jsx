import { useState } from 'react'
import Button from '../../components/kit/Button.jsx'
import Card from '../../components/kit/Card.jsx'
import FormField from '../../components/kit/FormField.jsx'
import PageHeader from '../../components/kit/PageHeader.jsx'
import StatusBadge from '../../components/kit/StatusBadge.jsx'
import { adminUsers as adminUsersSvc } from '../../api/services/index.js'
import { describe } from '../../api/errors.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { usePersona } from '../../context/PersonaContext.jsx'
import { IS_LIVE } from '../../config.js'

// admin_role wire values ↔ labels
const ROLES = ['ops_executive', 'credit_reviewer', 'compliance_reviewer', 'treasury_and_settlement', 'super_admin']
const ROLE_LABELS = {
  ops_executive: 'Ops Executive', credit_reviewer: 'Credit Reviewer', compliance_reviewer: 'Compliance Reviewer',
  treasury_and_settlement: 'Treasury & Settlement', super_admin: 'Super Admin',
}

export default function S16() {
  const { session } = useAuth()
  const { currentPersona } = usePersona()
  // Super-admin only. Nav already gates this; the backend enforces super_admin too (403 otherwise) — this is a
  // defensive UI guard for both modes.
  const isSuper = IS_LIVE ? (session?.roles ?? []).includes('super_admin') : currentPersona.id === 'super-admin'

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

  // 🔗 POST /admin-users/provision {email,display_name,phone} → a role-less 'invited' admin; returns admin_user_id.
  async function provision() {
    setPErr(''); setProvId(''); setPBusy(true)
    try {
      const env = await adminUsersSvc.provision({ email: pForm.email.trim(), display_name: pForm.display_name.trim(), phone: pForm.phone.trim() })
      const id = env?.aggregate_id ?? ''
      setProvId(id)
      setAForm(f => ({ ...f, admin_user_id: id }))       // prefill the assign form with the new id
      setPForm({ email: '', display_name: '', phone: '' })
    } catch (e) { setPErr(describe(e)) } finally { setPBusy(false) }
  }

  // 🔗 POST /admin-users/{id}/roles {role, override_reason?} — SoD-checked: a soft-pair role 400s asking for a reason.
  async function assign() {
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

  if (!isSuper) {
    return (
      <div>
        <PageHeader title="Admin & Roles" subtitle="Identity & Access Management" />
        <Card><p className="text-sm text-gray-500 py-4">Restricted to <span className="font-medium">Super Admin</span>.</p></Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Admin & Roles" subtitle="Provision admin users and assign roles · Super Admin only" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assign a role */}
        <Card title="Assign a role">
          <div className="flex flex-col gap-3">
            <FormField label="Admin User ID" id="aid" value={aForm.admin_user_id} onChange={aset('admin_user_id')} placeholder="admin_user_id (from a provision below, or paste one)" />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Role</label>
              <select className="rounded-md border border-gray-300 px-3 py-2 text-sm" value={aForm.role} onChange={aset('role')}>
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
            <FormField label={`Override reason${sodPrompt ? ' (required — SoD pair)' : ' (optional)'}`} id="ovr" value={aForm.override_reason} onChange={aset('override_reason')} placeholder="required only for a soft SoD role pair" />
            <Button disabled={aBusy || !aForm.admin_user_id.trim()} onClick={assign}>{aBusy ? 'Assigning…' : 'Assign Role'}</Button>
            {aMsg && <p className="text-xs text-green-600">✓ {aMsg}</p>}
            {aErr && <p className="text-xs text-red-600">Failed: {aErr}</p>}
          </div>
        </Card>

        {/* Provision a new admin */}
        <Card title="Provision a new admin">
          <div className="flex flex-col gap-3">
            <FormField label="Email" id="pemail" type="email" value={pForm.email} onChange={pset('email')} placeholder="new.admin@company.com" />
            <FormField label="Display name" id="pname" value={pForm.display_name} onChange={pset('display_name')} placeholder="Full name" />
            <FormField label="Phone" id="pphone" type="tel" value={pForm.phone} onChange={pset('phone')} placeholder="+9198…" />
            <Button disabled={pBusy || !pForm.email.trim() || !pForm.display_name.trim() || !pForm.phone.trim()} onClick={provision}>{pBusy ? 'Provisioning…' : 'Provision Admin'}</Button>
            {provId && (
              <div className="p-2 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-xs text-green-800">✓ Provisioned <StatusBadge label="invited" color="gray" /></p>
                <p className="text-[11px] font-mono text-gray-600 break-all mt-1">{provId}</p>
                <p className="text-[11px] text-gray-500 mt-1">Role-less until you assign a role (form on the left, pre-filled). Login credential setup is separate.</p>
              </div>
            )}
            {pErr && <p className="text-xs text-red-600">Failed: {pErr}</p>}
          </div>
        </Card>
      </div>

      <p className="text-xs text-gray-400 mt-6">Super Admin only (backend-enforced). Roles: AU10.1 · soft-SoD pairs require an override reason (C-SoD).</p>
    </div>
  )
}
