import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/kit/Button.jsx'
import Card from '../../components/kit/Card.jsx'
import FormField from '../../components/kit/FormField.jsx'
import PageHeader from '../../components/kit/PageHeader.jsx'
import StatusBadge from '../../components/kit/StatusBadge.jsx'
import Table from '../../components/kit/Table.jsx'
import { formatPaise, formatDate, fundingPct } from '../../utils/format.js'
import mockData from '../../data/mockData.js'

const VARIANTS = [
  { id: 'normal',                  label: 'Normal' },
  { id: 'agency_consent_inactive', label: 'Consent Inactive' },
  { id: 'ops_checks_failed',       label: 'Ops Checks Failed' },
]

const STATUS_COLOR = {
  submitted: 'gray', ops_checks_in_progress: 'amber', ops_checks_failed: 'red',
  listed: 'amber', live: 'amber', fully_funded: 'purple', disbursed: 'green', matured: 'green', closed: 'green',
}

const MOCK_GST = { invoice_number: 'INV-2026-0062', face_value: '4500000', invoice_date: '2026-05-20', tenor_days: '90' }

export default function S14() {
  const navigate = useNavigate()
  const [variant, setVariant] = useState('normal')
  const [tab, setTab] = useState('invoices')
  const [expandedId, setExpandedId] = useState(null)
  const [invoices, setInvoices] = useState(mockData.S14.invoices)
  const [mode, setMode] = useState('irn')
  const [draft, setDraft] = useState({ irn: '', invoice_number: '', buyer_id: '', face_value: '', invoice_date: '', tenor_days: '' })

  const { supplier } = mockData.S14
  const consentOff = variant === 'agency_consent_inactive'
  const checksFailed = variant === 'ops_checks_failed'

  function set(k) { return e => setDraft(d => ({ ...d, [k]: e.target.value })) }

  function submitInvoice() {
    const buyer = mockData.S14.available_buyers.find(b => b.buyer_id === draft.buyer_id)
    setInvoices(p => [{
      invoice_id: `inv-${Date.now()}`, invoice_number: draft.invoice_number || MOCK_GST.invoice_number,
      buyer_name: buyer?.legal_name ?? '—', face_value: parseInt(draft.face_value) || 0,
      invoice_date: draft.invoice_date, due_date: '', tenor_days: parseInt(draft.tenor_days) || 0,
      irn: mode === 'irn' ? draft.irn : null, status: 'submitted', listing: null,
    }, ...p])
    setDraft({ irn: '', invoice_number: '', buyer_id: '', face_value: '', invoice_date: '', tenor_days: '' })
    setTab('invoices')
  }

  const cols = [
    { key: 'invoice_number', label: 'Invoice #' },
    { key: 'buyer_name',     label: 'Buyer' },
    { key: 'face_value',     label: 'Face Value',  render: r => formatPaise(r.face_value) },
    { key: 'invoice_date',   label: 'Inv Date',    render: r => formatDate(r.invoice_date) },
    { key: 'due_date',       label: 'Due Date',    render: r => formatDate(r.due_date) },
    { key: 'status',         label: 'Status',
      render: r => {
        const s = checksFailed && r.invoice_id === 'inv-001' ? 'ops_checks_failed' : r.status
        return <StatusBadge label={s.replace(/_/g, ' ')} color={STATUS_COLOR[s] ?? 'gray'} />
      },
    },
    { key: 'listing',        label: 'Listing',
      render: r => r.listing ? <StatusBadge label={r.listing.status} color={STATUS_COLOR[r.listing.status] ?? 'gray'} /> : <span className="text-gray-400 text-xs">—</span>,
    },
    { key: 'expand',         label: '',
      render: r => <Button variant="ghost" className="text-xs py-1 px-2" onClick={() => setExpandedId(p => p === r.invoice_id ? null : r.invoice_id)}>{expandedId === r.invoice_id ? '▲' : '▼'}</Button>,
    },
  ]

  const exp = expandedId ? invoices.find(i => i.invoice_id === expandedId) : null
  const lst = exp?.listing

  return (
    <div>
      {/* Acting-as / consent banner */}
      <div className={`mb-5 p-3 rounded-xl border flex items-center gap-3 text-sm ${consentOff ? 'bg-red-50 border-red-300' : 'bg-amber-50 border-amber-300'}`}>
        <span>{consentOff ? '🚫' : '⚠'}</span>
        <div className="flex-1">
          {consentOff
            ? <span className="font-semibold text-red-800">Agency consent revoked — all actions blocked for {supplier.legal_name}.</span>
            : <><span className="font-semibold text-amber-900">Acting as: {supplier.legal_name}</span><span className="text-amber-700 ml-2">· Agency Consent: Active</span></>}
        </div>
        <Button variant="ghost" className="text-xs" onClick={() => navigate('/s3')}>Exit acting-as</Button>
      </div>

      <PageHeader title="Supplier Portal" subtitle={`${supplier.legal_name} · ${supplier.pan} · ${supplier.gstin}`} />

      <div className="flex items-center gap-2 flex-wrap mb-5">
        <span className="text-xs text-gray-400">Preview:</span>
        {VARIANTS.map(v => (
          <button key={v.id} onClick={() => setVariant(v.id)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${variant === v.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-300 hover:border-indigo-400'}`}>
            {v.label}
          </button>
        ))}
      </div>

      <div className="flex gap-1 border-b border-gray-200 mb-5">
        {[['invoices', 'Invoices'], ['upload', 'Upload Invoice']].map(([id, lbl]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {lbl}
          </button>
        ))}
      </div>

      {tab === 'invoices' && (
        <div>
          <Table columns={cols} rows={invoices} />
          {exp && (
            <Card className="mt-3">
              {!lst
                ? <p className="text-sm text-gray-500">Not yet listed — operational checks pending.</p>
                : <div>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="font-semibold text-sm">{lst.listing_id}</span>
                      <StatusBadge label={lst.status} color={STATUS_COLOR[lst.status] ?? 'gray'} />
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-3 text-sm">
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Funding Progress</p>
                        <div className="h-2 bg-gray-200 rounded-full"><div className="h-2 bg-indigo-500 rounded-full" style={{ width: `${fundingPct(lst.committed_total, lst.funding_target)}%` }} /></div>
                        <p className="text-xs text-gray-600 mt-0.5">{fundingPct(lst.committed_total, lst.funding_target)}% · {formatPaise(lst.committed_total)} / {formatPaise(lst.funding_target)}</p>
                      </div>
                      <div><p className="text-xs text-gray-400">Investors</p><p className="font-medium">{lst.investor_count}</p></div>
                      <div><p className="text-xs text-gray-400">Window Closes</p><p className="font-medium">{formatDate(lst.funding_window_close_at)}</p></div>
                      <div><p className="text-xs text-gray-400">Rate</p><p className="font-medium">{(lst.rate_bps / 100).toFixed(2)}% p.a.</p></div>
                    </div>
                    <div><p className="text-xs text-gray-400">Disbursement</p>
                      {lst.disbursed_at
                        ? <p className="text-sm text-green-700 font-medium">{formatDate(lst.disbursed_at)} · UTR: <span className="font-mono">{lst.disbursement_utr}</span></p>
                        : <p className="text-sm text-gray-500">Pending</p>}
                    </div>
                  </div>
              }
            </Card>
          )}
        </div>
      )}

      {tab === 'upload' && (
        <Card title="Upload Invoice">
          <div className="flex gap-4 mb-4">
            {[['irn', 'Enter IRN (DL-016)'], ['manual', 'Manual Entry']].map(([m, lbl]) => (
              <label key={m} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="mode" checked={mode === m} onChange={() => setMode(m)} /> {lbl}
              </label>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            {mode === 'irn'
              ? <div className="col-span-2 flex gap-3 items-end">
                  <div className="flex-1"><FormField label="IRN (54 chars)" id="irn" value={draft.irn} maxLength={54} onChange={set('irn')} disabled={consentOff} /></div>
                  <Button variant="ghost" disabled={consentOff} onClick={() => setDraft(d => ({ ...d, ...MOCK_GST }))}>Fetch from GST</Button>
                </div>
              : <FormField label="Invoice Number" id="inv_num" value={draft.invoice_number} onChange={set('invoice_number')} disabled={consentOff} />
            }
            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Buyer</label>
              <select className="rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500" disabled={consentOff} value={draft.buyer_id} onChange={set('buyer_id')}>
                <option value="">— Select buyer —</option>
                {mockData.S14.available_buyers.map(b => <option key={b.buyer_id} value={b.buyer_id}>{b.legal_name}</option>)}
              </select>
            </div>
            <FormField label="Face Value (paise)" id="fv"    type="number" value={draft.face_value}   onChange={set('face_value')}   disabled={consentOff} />
            <FormField label="Invoice Date"        id="idate" type="date"   value={draft.invoice_date} onChange={set('invoice_date')} disabled={consentOff} />
            <FormField label="Tenor days (1–180)"  id="tenor" type="number" min={1} max={180} value={draft.tenor_days} onChange={set('tenor_days')} disabled={consentOff} />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Invoice document PDF</label>
              <Button variant="ghost" className="self-start text-xs" disabled={consentOff}>Mock Upload</Button>
            </div>
          </div>
          <Button disabled={consentOff} onClick={submitInvoice}>Submit Invoice</Button>
          {consentOff && <p className="text-xs text-red-600 mt-2">Agency consent revoked — all actions blocked.</p>}
        </Card>
      )}

      <p className="text-xs text-gray-400 mt-6">Rules: DL-012/DL-013 · DL-016 (IRN preferred) · DL-017 (aggregate funding only) · AC.3</p>
    </div>
  )
}
