import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/kit/Button.jsx'
import Card from '../../components/kit/Card.jsx'
import PageHeader from '../../components/kit/PageHeader.jsx'
import StatusBadge from '../../components/kit/StatusBadge.jsx'
import Table from '../../components/kit/Table.jsx'
import { formatPaise, formatDate } from '../../utils/format.js'
import mockData from '../../data/mockData.js'
import { useStore } from '../../store/PlatformStore.jsx'
import { investors as investorsSvc, distributionTax as taxSvc } from '../../api/services/index.js'
import { session as authSession } from '../../api/services/auth.js'
import { IS_LIVE, IS_DEV_BACKEND } from '../../config.js'

// The investor persona whose positions this portfolio shows (matches S12 commits) — mock-mode only.
const INVESTOR = { id: 'inv-acct-001', name: 'Rahul Mehta' }

const VARIANTS = [
  { id: 'normal',           label: 'Normal' },
  { id: 'empty_portfolio',  label: 'Empty Portfolio' },
  { id: 'kyc_refresh_due',  label: 'KYC Refresh Due' },
  { id: 'investor_suspended', label: 'Investor Suspended' },
]

const SUB_STATUS_COLOR = {
  committed:            'amber',
  funds_pending:        'amber',
  confirmed:            'amber',
  assignment_executed:  'purple',
  distribution_received:'green',
  closed:               'green',
  refunded:             'gray',
}

export default function S13() {
  const navigate = useNavigate()
  const [variant, setVariant] = useState('normal')
  const [accountOpen, setAccountOpen] = useState(false)
  const [downloadMsg, setDownloadMsg] = useState('')
  // Mock mode: positions + summary come from the store (P4 — reflect S12 commits and S7 outcomes); TDS + statements
  // from mockData. Live mode: one call GET /investors/{id}/subscriptions → {rows, summary} (BE-17) + the tax reads.
  const { investorPortfolio, investorSummary } = useStore()
  const { investor, tds, statements } = mockData.S13
  const [live, setLive] = useState(null)          // { rows, summary, tds, statements } in live mode
  const [loading, setLoading] = useState(IS_LIVE)
  const [liveErr, setLiveErr] = useState('')

  // Live: scope reads to the session's own investor_id (BE-17); in dev, an admin bearer falls back to the seeded
  // investor (admin may read any investor). Real investor login is dev-password today; unchanged for BE-18.
  useEffect(() => {
    if (!IS_LIVE) return
    let alive = true
    ;(async () => {
      setLoading(true); setLiveErr('')
      try {
        let id = null
        try { const s = await authSession(); if (s?.kind === 'investor') id = s.investor_id } catch { /* not an investor session */ }
        if (!id && IS_DEV_BACKEND) id = (await investorsSvc.devSeedInfo())?.investor_id
        if (!id) throw new Error('No investor session — log in as an investor to view a portfolio.')
        const [port, ded, stm] = await Promise.all([
          investorsSvc.subscriptions(id),
          taxSvc.deductions(id).catch(() => []),
          taxSvc.statements(id).catch(() => []),
        ])
        if (alive) setLive({ rows: port?.rows ?? [], summary: port?.summary ?? {}, tds: ded ?? [], statements: stm ?? [] })
      } catch (e) { if (alive) setLiveErr(e?.message || String(e)) }
      finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [])

  const subscriptions = IS_LIVE ? (live?.rows ?? []) : investorPortfolio(INVESTOR.id)
  const summary       = IS_LIVE ? (live?.summary ?? {}) : investorSummary(INVESTOR.id)
  const tdsRows       = IS_LIVE ? (live?.tds ?? []) : tds
  const statementRows = IS_LIVE ? (live?.statements ?? []) : statements

  function mockDownload(name) {  // 🔗 GET …/tax/form-16a/{fy} · GET …/tax/statements (mock stand-in; live binary download pending)
    setDownloadMsg(`${name} downloaded (mock)`)
    setTimeout(() => setDownloadMsg(''), 4000)
  }

  // Live: empty is derived from real rows; the mismatch/kyc/suspended states are mock-only preview variants.
  const isEmpty = IS_LIVE ? (!loading && subscriptions.length === 0) : variant === 'empty_portfolio'
  const isKycDue = !IS_LIVE && variant === 'kyc_refresh_due'
  const isSuspended = !IS_LIVE && variant === 'investor_suspended'

  // Summary card definitions
  const summaryCards = [
    { label: 'Total Deployed',   value: formatPaise(summary.total_deployed_paise ?? 0) },
    { label: 'Total Returned',   value: formatPaise(summary.total_returned_paise ?? 0) },
    { label: 'Active Positions', value: summary.active_positions ?? 0 },
    { label: 'Matured',          value: summary.matured_positions ?? 0 },
  ]

  // Positions table columns with custom renderers
  const positionColumns = [
    {
      key: 'listing', label: 'Listing',
      render: row => (
        <div>
          <p className="font-medium text-gray-900 text-sm">{row.buyer_name}</p>
          <p className="text-xs text-gray-400">{row.supplier_name}</p>
        </div>
      ),
    },
    {
      key: 'amount', label: 'Amount',
      render: row => <span className="font-medium">{formatPaise(row.amount)}</span>,
    },
    {
      key: 'status', label: 'Status',
      render: row => <StatusBadge label={row.status} color={SUB_STATUS_COLOR[row.status] ?? 'gray'} />,
    },
    {
      key: 'due_date', label: 'Due Date',
      render: row => formatDate(row.due_date),
    },
    {
      key: 'distribution', label: 'Distribution',
      render: row => row.distribution_outcome
        ? (
          <div title={`Gross: ${formatPaise(row.distribution_outcome.gross)} | TDS: ${formatPaise(row.distribution_outcome.tds)} | Fee: ${formatPaise(row.distribution_outcome.fee)}`}
            className="cursor-help">
            <span className="text-green-700 font-medium">{formatPaise(row.distribution_outcome.net)}</span>
            <span className="text-gray-400 text-xs ml-1">(net)</span>
          </div>
        )
        : <span className="text-gray-400">—</span>,
    },
    {
      key: 'action', label: '',
      render: row => (
        <Button variant="ghost" className="text-xs py-1 px-3"
          onClick={() => navigate('/s12', { state: { listingId: row.listing_id } })}>
          View
        </Button>
      ),
    },
  ]

  // TDS table columns
  const tdsColumns = [
    { key: 'fy_code',           label: 'FY' },
    { key: 'buyer',             label: 'Buyer',       render: row => row.buyer_name ?? (row.listing_id ? `${row.listing_id.slice(0, 8)}…` : '—') },
    { key: 'gross_paise',       label: 'Gross (₹)',   render: row => formatPaise(row.gross_paise) },
    { key: 'tds_amount_paise',  label: 'TDS (₹)',     render: row => formatPaise(row.tds_amount_paise) },
    { key: 'fee_paise',         label: 'Fee (₹)',     render: row => formatPaise(row.fee_paise) },
    { key: 'net_paise',         label: 'Net (₹)',     render: row => <span className="font-medium text-green-700">{formatPaise(row.net_paise)}</span> },
    {
      key: 'challan', label: 'Challan / Form 16A',
      render: row => row.challan_ref
        ? <Button variant="ghost" className="text-xs py-1 px-3" onClick={() => mockDownload(`Form 16A ${row.fy_code}`)}>Download Form 16A</Button>
        : <span className="text-gray-400 text-xs">Pending</span>,
    },
  ]

  // Statements table columns
  const statementColumns = [
    { key: 'period',       label: 'Period' },
    { key: 'kind',         label: 'Type',       render: row => row.kind === 'monthly_portfolio' ? 'Monthly Statement' : 'Form 16A' },
    { key: 'generated_at', label: 'Generated',  render: row => formatDate(row.generated_at) },
    { key: 'action',       label: '',           render: row => <Button variant="ghost" className="text-xs py-1 px-3" onClick={() => mockDownload(row.kind === 'monthly_portfolio' ? `Statement ${row.period}` : 'Form 16A')}>Download</Button> },
  ]

  return (
    <div>
      <PageHeader title="My Portfolio" subtitle="Active positions, returns, and statements" />

      {downloadMsg && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">✓ {downloadMsg}</div>
      )}

      {/* Live status */}
      {IS_LIVE && loading && <p className="text-xs text-gray-400 mb-4">Loading portfolio…</p>}
      {IS_LIVE && liveErr && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">Live load failed: {liveErr}</div>}

      {/* Variant switcher — mock-mode preview states only */}
      {!IS_LIVE && (
        <div className="flex items-center gap-2 flex-wrap mb-6">
          <span className="text-xs text-gray-400">Preview state:</span>
          {VARIANTS.map(v => (
            <button key={v.id} onClick={() => setVariant(v.id)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${variant === v.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-300 hover:border-indigo-400'}`}>
              {v.label}
            </button>
          ))}
        </div>
      )}

      {/* KYC refresh banner */}
      {isKycDue && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3 items-start">
          <span className="text-amber-500 text-lg">⚠</span>
          <div>
            <p className="font-semibold text-amber-800 text-sm">KYC Refresh Due</p>
            <p className="text-sm text-amber-700">Your KYC is due for renewal (C17). Please update your documents to avoid any disruption. Due: {formatDate(investor.kyc_refresh_due_at)}</p>
          </div>
        </div>
      )}

      {/* Investor suspended banner */}
      {isSuspended && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex gap-3 items-start">
          <span className="text-red-500 text-lg">⛔</span>
          <p className="text-sm text-red-700">Your account is suspended. All positions are read-only. Contact support to resolve.</p>
        </div>
      )}

      {/* Empty portfolio CTA */}
      {isEmpty ? (
        <Card>
          <div className="text-center py-14">
            <p className="font-semibold text-gray-700 mb-1">No active positions yet</p>
            <p className="text-sm text-gray-400 mb-6">Browse live listings to start investing.</p>
            <Button onClick={() => navigate('/s11')}>Browse Listings →</Button>
          </div>
        </Card>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {summaryCards.map(c => (
              <Card key={c.label} className="py-4">
                <p className="text-xs text-gray-400 mb-1">{c.label}</p>
                <p className="text-xl font-bold text-gray-900">{c.value}</p>
              </Card>
            ))}
          </div>

          {/* Positions table */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Positions</h2>
            <Table columns={positionColumns} rows={subscriptions} />
            <p className="text-xs text-gray-400 mt-1">Hover Distribution column for gross/TDS/fee breakdown. Rules: DL-045/G4 (gross−tds−fee=net) · DL-030 (T+1 distribution)</p>
          </div>

          {/* TDS section */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">TDS Deductions</h2>
            <Table columns={tdsColumns} rows={tdsRows} />
          </div>

          {/* Statements section */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Statements</h2>
            <Table columns={statementColumns} rows={statementRows} />
            {/* TBD: Form 16A download from screen directly or emailed only? */}
          </div>

          {/* Account details (collapsible) — mock-mode only (no live PII read wired here) */}
          {!IS_LIVE && (
          <div className="mb-4">
            <button
              onClick={() => setAccountOpen(o => !o)}
              className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
              <span>{accountOpen ? '▾' : '▸'}</span> Account Details
            </button>
            {accountOpen && (
              <Card>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div><p className="text-xs text-gray-400">Type</p><p className="text-gray-900">{investor.sub_type.replace('_', ' ')}</p></div>
                  <div><p className="text-xs text-gray-400">PAN</p><p className="font-mono text-gray-900">{investor.pan}</p></div>
                  <div><p className="text-xs text-gray-400">Aadhaar (last 4)</p><p className="font-mono text-gray-900">••••{investor.aadhaar_last4}</p></div>
                  <div><p className="text-xs text-gray-400">Bank (last 4)</p><p className="font-mono text-gray-900">••••{investor.bank_account_last4}</p></div>
                  <div><p className="text-xs text-gray-400">Activated</p><p className="text-gray-900">{formatDate(investor.activated_at)}</p></div>
                  <div><p className="text-xs text-gray-400">KYC Refresh Due</p><p className="text-gray-900">{formatDate(investor.kyc_refresh_due_at)}</p></div>
                </div>
              </Card>
            )}
          </div>
          )}
        </>
      )}

      <div className="mt-4">
        <Button variant="ghost" onClick={() => navigate('/s11')}>← Browse More Listings</Button>
      </div>
      <p className="text-xs text-gray-400 mt-4">Rules: DL-045/G4 · DL-030 (T+1) · C17 (KYC refresh) · G19/X14 (tenant isolation)</p>
    </div>
  )
}
