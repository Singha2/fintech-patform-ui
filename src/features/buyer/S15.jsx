import { useState } from 'react'
import Button from '../../components/kit/Button.jsx'
import Card from '../../components/kit/Card.jsx'
import FormField from '../../components/kit/FormField.jsx'
import PageHeader from '../../components/kit/PageHeader.jsx'
import StatusBadge from '../../components/kit/StatusBadge.jsx'
import Table from '../../components/kit/Table.jsx'
import { formatPaise, formatDate } from '../../utils/format.js'
import mockData from '../../data/mockData.js'
import { useStore } from '../../store/PlatformStore.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { buyers as buyersSvc, listings as listingsSvc } from '../../api/services/index.js'
import { devLastOtp } from '../../api/services/auth.js'
import { describe } from '../../api/errors.js'
import { IS_LIVE, IS_DEV_BACKEND } from '../../config.js'

const VARIANTS = [
  { id: 'normal',              label: 'Normal' },
  { id: 'no_pending_invoices', label: 'No Pending' },
  { id: 'buyer_suspended',     label: 'Suspended' },
]

const TODAY = new Date()

// Map a live BE-15 ack-invoice row → the table's display shape. Backend ack_status is 'requested'|'acknowledged';
// normalize 'requested' → 'pending' so the existing renderers (Acknowledge button, SLA cell) work unchanged.
function mapAckRow(r) {
  const deadline = r.requested_at && r.sla_hours != null
    ? new Date(new Date(r.requested_at).getTime() + r.sla_hours * 3600 * 1000).toISOString()
    : null
  return {
    invoice_id: r.listing_id,          // self-ack targets the listing
    invoice_number: r.invoice_number,
    supplier_name: r.supplier_name,
    face_value: r.face_value_paise,
    invoice_date: r.invoice_date,
    due_date: r.due_date,
    ack_status: r.ack_status === 'requested' ? 'pending' : r.ack_status,
    ack_sla_deadline: deadline,
    acknowledged_at: r.acknowledged_at,
    noa_available: false,              // NOA download deferred (BC5) — not in BE-15
  }
}

export default function S15() {
  const { buyerInvoices, acknowledgeInvoice } = useStore()
  const { session, beginAckUserLogin, completeLogin, logout } = useAuth()
  const [variant, setVariant] = useState('normal')
  const [email, setEmail] = useState(IS_LIVE ? 'ack@dev.local' : mockData.S15.login.email)
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState('')
  const [verified, setVerified] = useState(false)
  const [confirmInv, setConfirmInv] = useState(null)
  const [live, setLive] = useState(null)      // { invoices, pi } in live mode
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const { buyer, payment_instruction: pi } = mockData.S15

  // Live: fetch the ack-user's own invoices + payment-instruction (own-scoped to the session buyer_id).
  async function loadLive(buyerId) {
    const id = buyerId ?? session?.buyer_id
    if (!id) return
    setLoading(true); setErr('')
    try {
      const [inv, payinfo] = await Promise.all([
        buyersSvc.ackInvoices(id),
        buyersSvc.paymentInstruction(id).catch(() => null),
      ])
      setLive({ invoices: (inv ?? []).map(mapAckRow), pi: payinfo })
    } catch (e) { setErr(describe(e)) } finally { setLoading(false) }
  }

  async function sendOtp() {
    setErr('')
    if (!IS_LIVE) { setOtpSent(true); return }         // mock: local OTP screen
    setBusy(true)
    try {
      await beginAckUserLogin(email.trim())            // passwordless ack-user login (BE-15)
      setOtpSent(true)
      if (IS_DEV_BACKEND) { try { const { code } = await devLastOtp(email.trim()); if (code) setOtp(code) } catch { /* ignore */ } }
    } catch (e) { setErr(describe(e)) } finally { setBusy(false) }
  }

  async function verify() {
    setErr('')
    if (!IS_LIVE) { if (otp.length === 6) setVerified(true); return }
    setBusy(true)
    try {
      const { session: s } = await completeLogin(otp.trim())
      setVerified(true)
      await loadLive(s?.buyer_id)
    } catch (e) { setErr(describe(e)) } finally { setBusy(false) }
  }

  async function acknowledge(id) {
    setConfirmInv(null)
    if (!IS_LIVE) { acknowledgeInvoice(id); return }   // mock store ack
    setBusy(true); setErr('')
    try {
      const cur = await listingsSvc.get(id)            // fresh version
      await listingsSvc.recordBuyerAck(id, { outcome: 'acknowledged' }, cur.aggregate_version)  // self-ack (own buyer)
      await loadLive()
    } catch (e) { setErr(describe(e)) } finally { setBusy(false) }
  }

  function handleLogout() {
    if (IS_LIVE) logout()                              // real server-side revoke (DL-BE-089)
    setVerified(false); setOtpSent(false); setOtp(''); setLive(null); setErr('')
  }

  const invoices = IS_LIVE ? (live?.invoices ?? []) : buyerInvoices(buyer.buyer_id)

  function slaCell(inv) {
    if (inv.ack_status === 'acknowledged') return <span className="text-green-600 text-xs">{formatDate(inv.acknowledged_at)}</span>
    if (inv.ack_status !== 'pending') return null
    if (!inv.ack_sla_deadline) return <span className="text-amber-600 text-xs font-medium">Awaiting ack</span>
    return new Date(inv.ack_sla_deadline) < TODAY
      ? <StatusBadge label="Overdue" color="red" />
      : <span className="text-amber-600 text-xs font-medium">Due {formatDate(inv.ack_sla_deadline)}</span>
  }

  const cols = [
    { key: 'invoice_number', label: 'Invoice #' },
    { key: 'supplier_name',  label: 'Supplier' },
    { key: 'face_value',     label: 'Amount',   render: r => formatPaise(r.face_value) },
    { key: 'invoice_date',   label: 'Inv Date', render: r => formatDate(r.invoice_date) },
    { key: 'due_date',       label: 'Due Date', render: r => formatDate(r.due_date) },
    { key: 'ack_status',     label: 'Status',   render: r => <StatusBadge label={r.ack_status} color={r.ack_status === 'acknowledged' ? 'green' : r.ack_status === 'rejected' ? 'red' : 'amber'} /> },
    { key: 'sla',            label: 'SLA',      render: slaCell },
    { key: 'action',         label: '',
      render: r => r.ack_status === 'pending'
        ? <Button className="text-xs py-1 px-3" disabled={busy} onClick={() => setConfirmInv(r)}>Acknowledge</Button>
        : <Button variant="ghost" className="text-xs py-1 px-3" disabled={!r.noa_available} title={!r.noa_available ? 'Assignment notice issued after funding' : ''}>View NOA</Button>,
    },
  ]

  const isSuspended = !IS_LIVE && variant === 'buyer_suspended'
  const displayInvoices = (!IS_LIVE && variant === 'no_pending_invoices') ? invoices.filter(i => i.ack_status === 'acknowledged') : invoices

  if (!verified) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <p className="text-lg font-bold text-gray-900 mb-1">Buyer Portal</p>
          <p className="text-sm text-gray-500 mb-6">{IS_LIVE ? 'Invoice acknowledgment · passwordless (email + OTP)' : `Invoice acknowledgment · ${buyer.legal_name}`}</p>
          {!otpSent
            ? <div className="space-y-4">
                <FormField label="Email" id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
                {err && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{err}</p>}
                <Button className="w-full" disabled={busy || !email} onClick={sendOtp}>{busy ? 'Sending…' : 'Send OTP'}</Button>
              </div>
            : <div className="space-y-4">
                <p className="text-sm text-gray-600">OTP sent to <span className="font-medium">{email}</span></p>
                <FormField label="Enter the OTP sent to your email" id="otp" maxLength={6} value={otp} onChange={e => setOtp(e.target.value)} placeholder="6-digit code" />
                {IS_LIVE && IS_DEV_BACKEND && <p className="text-xs text-indigo-600">Dev: OTP auto-filled from /dev/last-otp.</p>}
                {err && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{err}</p>}
                <Button className="w-full" disabled={busy || otp.length !== 6} onClick={verify}>{busy ? 'Verifying…' : 'Verify'}</Button>
                <Button variant="ghost" className="w-full text-xs" onClick={() => { setOtpSent(false); setOtp(''); setErr('') }}>Resend OTP</Button>
              </div>
          }
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <span className="font-semibold text-gray-900 text-sm">{IS_LIVE ? (session?.email ?? 'Ack User') : `${buyer.legal_name} · ${buyer.ack_user.display_name}`}</span>
        <Button variant="ghost" className="text-xs" onClick={handleLogout}>Log out</Button>
      </div>

      <div className="max-w-5xl mx-auto p-6">
        {/* Variant switcher — mock-mode preview states only */}
        {!IS_LIVE && (
          <div className="flex items-center gap-2 flex-wrap mb-5">
            <span className="text-xs text-gray-400">Preview:</span>
            {VARIANTS.map(v => (
              <button key={v.id} onClick={() => setVariant(v.id)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${variant === v.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-300 hover:border-indigo-400'}`}>
                {v.label}
              </button>
            ))}
          </div>
        )}
        {IS_LIVE && loading && <p className="text-xs text-gray-400 mb-4">Loading invoices…</p>}
        {IS_LIVE && err && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">{err}</div>}

        {isSuspended
          ? <Card><div className="text-center py-12">
              <p className="font-semibold text-red-700 text-lg mb-2">Account Suspended</p>
              <p className="text-sm text-gray-500">Your account has been temporarily suspended. Please contact <span className="text-indigo-600">support@platform.com</span>.</p>
            </div></Card>
          : <>
              {confirmInv && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                  <Card className="w-full max-w-md">
                    <p className="font-semibold text-gray-900 mb-2">Acknowledge Invoice</p>
                    <p className="text-sm text-gray-600 mb-4">Acknowledge <span className="font-medium">{confirmInv.invoice_number}</span> from {confirmInv.supplier_name} for {formatPaise(confirmInv.face_value)}?</p>
                    <div className="flex gap-3">
                      <Button disabled={busy} onClick={() => acknowledge(confirmInv.invoice_id)}>{busy ? 'Acknowledging…' : 'Confirm Acknowledgment'}</Button>
                      <Button variant="ghost" onClick={() => setConfirmInv(null)}>Cancel</Button>
                    </div>
                  </Card>
                </div>
              )}

              <PageHeader title={IS_LIVE ? 'Invoices' : `Invoices · ${buyer.legal_name}`} subtitle="Per-invoice acknowledgment (DL-019)" />
              {displayInvoices.length === 0
                ? <Card><p className="text-center text-gray-400 py-8">No invoices pending acknowledgment.</p></Card>
                : <Table columns={cols} rows={displayInvoices} />
              }
              <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-xs text-gray-500">Bulk acknowledgment, dispute filing, and statements are not available in Phase 1.</p>
              </div>

              <div className="mt-8">
                <h2 className="text-base font-semibold text-gray-900 mb-3">Payment Instructions</h2>
                {IS_LIVE
                  ? <Card>
                      {live?.pi?.present
                        ? <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                            <div><p className="text-xs text-gray-400">Effective From</p><p>{formatDate(live.pi.effective_from)}</p></div>
                            <div><p className="text-xs text-gray-400">Confirmed</p><p>{formatDate(live.pi.confirmed_at)}</p></div>
                            <p className="col-span-2 text-xs text-gray-500 italic">Bank account details are captured out-of-band and not yet surfaced by the API (BE-15 metadata-only).</p>
                          </div>
                        : <p className="text-sm text-gray-500">No payment instruction on file yet.</p>}
                    </Card>
                  : <>
                      <Card>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm mb-4">
                          <div><p className="text-xs text-gray-400">Bank</p><p className="font-medium">{pi.escrow_bank}</p></div>
                          <div><p className="text-xs text-gray-400">Account Name</p><p className="font-medium">{pi.account_name}</p></div>
                          <div>
                            <p className="text-xs text-gray-400">Account Number</p>
                            <div className="flex items-center gap-2">
                              <p className="font-mono text-sm">{pi.account_number}</p>
                              <Button variant="ghost" className="text-xs py-0.5 px-2" onClick={() => navigator.clipboard?.writeText(pi.account_number)}>Copy</Button>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">IFSC</p>
                            <div className="flex items-center gap-2">
                              <p className="font-mono text-sm">{pi.ifsc}</p>
                              <Button variant="ghost" className="text-xs py-0.5 px-2" onClick={() => navigator.clipboard?.writeText(pi.ifsc)}>Copy</Button>
                            </div>
                          </div>
                          <div><p className="text-xs text-gray-400">Effective From</p><p>{formatDate(pi.effective_from)}</p></div>
                        </div>
                        <p className="text-xs text-gray-500 italic">{pi.note}</p>
                      </Card>
                      <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-sm text-amber-800">Pay the exact invoice face value to this account on or before the due date. Use the invoice number as the payment reference.</p>
                      </div>
                    </>
                }
              </div>

              <p className="text-xs text-gray-400 mt-6">Rules: DL-021 (minimal scope) · AU.1 (OTP-only) · DL-019 (per-invoice ack) · G19/X14</p>
            </>
        }
      </div>
    </div>
  )
}
