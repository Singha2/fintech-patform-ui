import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import Button from '../../components/kit/Button.jsx'
import Card from '../../components/kit/Card.jsx'
import FormField from '../../components/kit/FormField.jsx'
import PageHeader from '../../components/kit/PageHeader.jsx'
import StatusBadge from '../../components/kit/StatusBadge.jsx'
import { formatPaise, formatRupees, formatRate, formatDate, formatDatetime, fundingPct } from '../../utils/format.js'
import mockData from '../../data/mockData.js'
import { subscriptions as subscriptionsSvc, investors as investorsSvc } from '../../api/services/index.js'
import { describe } from '../../api/errors.js'
import { IS_LIVE, IS_DEV_BACKEND } from '../../config.js'
import { useStore } from '../../store/PlatformStore.jsx'
import { useHydrate } from '../../store/useHydrate.js'

const VARIANTS = [
  { id: 'not_subscribed',          label: 'Not Subscribed' },
  { id: 'committed',               label: 'Committed' },
  { id: 'funding_window_closed',   label: 'Window Closed' },
  { id: 'fully_funded_no_headroom', label: 'No Headroom' },
]

const CHECK_LABELS = {
  irn_validity:    'IRN Verified',
  buyer_ack:       'Buyer Acknowledgement',
  duplicate_check: 'Duplicate Check',
}

// The investor persona whose portfolio these commits land in (matches the seeded S13 investor).
const INVESTOR = { id: 'inv-acct-001', name: 'Rahul Mehta' }

export default function S12() {
  const navigate = useNavigate()
  const location = useLocation()
  const { listingDetail } = useStore()

  // Resolve the clicked listing from the shared store (closes G-C3); fall back to the seeded sample for the
  // demo listing and to fill fields a store-created listing may not carry (nested parties, VA, snapshot).
  const sample = mockData.S12
  const listingId = location.state?.listingId ?? sample.listing.listing_id
  const live = useHydrate(['listingDetail', listingId], [listingId])  // live: GET /listings/{id}/detail + ops-checks (BE-10)
  const detail = listingDetail(listingId)
  const listing = detail?.listing ?? sample.listing
  const invoice = detail?.invoice ?? sample.invoice
  const buyer = {
    name:          detail?.buyer?.legal_name ?? listing.buyer_name ?? sample.buyer.name,
    sector:        detail?.buyer?.sector ?? listing.buyer_sector ?? sample.buyer.sector,
    rating:        detail?.buyer?.rating ?? sample.buyer.rating,
    rating_source: detail?.buyer?.rating_source ?? sample.buyer.rating_source,
  }
  const supplier = {
    name:              detail?.supplier?.legal_name ?? listing.supplier_name ?? sample.supplier.name,
    constitution_type: detail?.supplier?.constitution_type ?? sample.supplier.constitution_type,
  }

  const [variant, setVariant] = useState('not_subscribed')
  const [amount, setAmount] = useState('')
  const [subscription, setSubscription] = useState(null)
  const [copied, setCopied] = useState(false)
  const [amountErr, setAmountErr] = useState('')

  // Normalized display fields — a store-created listing may lack a pricing snapshot / VA until go-live.
  const rateBps = listing.pricing_snapshot?.rate_bps ?? listing.rate_bps ?? 0
  const feeBps = listing.pricing_snapshot?.fee_bps ?? 50
  const snapshotAt = listing.pricing_snapshot?.snapshot_at ?? null
  const vaNumber = listing.virtual_account_number ?? sample.listing.virtual_account_number
  const vaIfsc = listing.virtual_account_ifsc ?? sample.listing.virtual_account_ifsc
  const committedTotal = listing.committed_total ?? 0
  const fundingTarget = listing.funding_target ?? 0
  const tenorDays = invoice?.tenor_days ?? listing.tenor_days ?? 0
  const amtNum = parseFloat(amount) || 0
  const grossReturn = amtNum * (rateBps / 10000) * (tenorDays / 365)
  const tdsAmt = grossReturn * 0.10
  const netReturn = grossReturn - tdsAmt
  const pct = fundingPct(committedTotal, fundingTarget)

  // 🔗 POST /listings/{id}/subscriptions/commit {investor_id, amount_paise} — ops-on-behalf (OPS role; investor
  // self-commit is BE-18). investor_id must be a REAL backend id: in live+dev we resolve the seeded active
  // investor from /dev/seed-info; INVESTOR.id is the mock-mode placeholder. BE-18 (investor login) replaces this
  // with the logged-in investor's own id.
  async function resolveInvestorId() {
    if (IS_LIVE && IS_DEV_BACKEND) return (await investorsSvc.devSeedInfo())?.investor_id ?? INVESTOR.id
    return INVESTOR.id
  }
  async function handleCommit() {
    if (amtNum < 10000) { setAmountErr('Minimum investment is ₹10,000 (DL-007).'); return }
    if (committedTotal + amtNum * 100 > fundingTarget) { setAmountErr('Amount exceeds remaining headroom (G10/L.2).'); return }
    setAmountErr('')
    try {
      const investor_id = await resolveInvestorId()
      const env = await subscriptionsSvc.commit(listingId, { investor_id, amount_paise: amtNum * 100 })
      await live.reload()
      setSubscription({ subscription_id: env?.aggregate_id ?? 'sub-new', amount: amtNum * 100, status: 'committed' })
      setVariant('committed')
    } catch (e) { setAmountErr(describe(e)) }
  }

  function handleCopy() {
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const isWindowClosed = variant === 'funding_window_closed'
  const isNoHeadroom = variant === 'fully_funded_no_headroom'

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <Button variant="ghost" className="text-xs" onClick={() => navigate('/s11')}>← Back to Listings</Button>
      </div>
      <PageHeader
        title={buyer.name ?? listing.listing_id}
        subtitle={`Listing ${listing.listing_id} · ${buyer.sector ?? ''}`}
      />
      {live.error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">Live load failed: {live.error}</div>}
      {live.loading && <p className="text-xs text-gray-400 mb-4">Loading listing…</p>}

      {/* State variant switcher */}
      <div className="flex items-center gap-2 flex-wrap mb-6">
        <span className="text-xs text-gray-400">Preview state:</span>
        {VARIANTS.map(v => (
          <button key={v.id} onClick={() => setVariant(v.id)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${variant === v.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-300 hover:border-indigo-400'}`}>
            {v.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── Left column (3/5) ─────────────────── */}
        <div className="lg:col-span-3 flex flex-col gap-4">

          {/* Listing Header */}
          <Card title="Listing Overview">
            <div className="flex gap-2 mb-3 flex-wrap">
              <StatusBadge label={listing.status === 'live' ? 'Live' : 'Fully Funded'} color={listing.status === 'live' ? 'green' : 'gray'} />
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm mb-4">
              <div><p className="text-xs text-gray-400">Funding Target</p><p className="font-semibold text-gray-900">{formatPaise(fundingTarget)}</p></div>
              <div><p className="text-xs text-gray-400">Committed</p><p className="font-semibold text-gray-900">{formatPaise(committedTotal)}</p></div>
              <div><p className="text-xs text-gray-400">Rate</p><p className="font-semibold text-gray-900">{formatRate(rateBps)}</p></div>
              <div><p className="text-xs text-gray-400">Platform Fee</p><p className="font-semibold text-gray-900">{(feeBps / 100).toFixed(2)}%</p></div>
            </div>
            <div className="mb-1 flex justify-between text-xs text-gray-400">
              <span>Funding progress</span><span>{pct}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
              <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs text-gray-400">Window closes {formatDate(listing.funding_window_close_at)}{snapshotAt ? ` · Pricing snapshot ${formatDatetime(snapshotAt)}` : ''}</p>
          </Card>

          {/* Invoice */}
          <Card title="Invoice Details">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm mb-4">
              <div><p className="text-xs text-gray-400">Invoice No.</p><p className="font-medium text-gray-900">{invoice.invoice_number}</p></div>
              <div><p className="text-xs text-gray-400">Face Value</p><p className="font-medium text-gray-900">{formatPaise(invoice.face_value)}</p></div>
              <div><p className="text-xs text-gray-400">Invoice Date</p><p className="font-medium text-gray-900">{formatDate(invoice.invoice_date)}</p></div>
              <div><p className="text-xs text-gray-400">Due Date</p><p className="font-medium text-gray-900">{formatDate(invoice.due_date)}</p></div>
              <div><p className="text-xs text-gray-400">Tenor</p><p className="font-medium text-gray-900">{invoice.tenor_days} days</p></div>
            </div>
            <div className="mb-3">
              <p className="text-xs text-gray-400 mb-1">IRN</p>
              <p className="font-mono text-xs text-gray-700 break-all">{invoice.irn ? `${invoice.irn.slice(0, 24)}…` : '—'}</p>
            </div>
            <div className="overflow-x-auto rounded-lg border border-gray-100">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50"><tr>
                  <th className="px-3 py-2 text-left text-gray-500 font-medium">Check</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-medium">Result</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-medium">Detail</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {Object.entries(invoice.check_outcomes ?? {}).map(([key, val]) => (
                    <tr key={key}>
                      <td className="px-3 py-2 text-gray-700">{CHECK_LABELS[key] ?? key}</td>
                      <td className="px-3 py-2"><StatusBadge label={val.outcome} color={val.outcome === 'pass' ? 'green' : 'red'} /></td>
                      <td className="px-3 py-2 text-gray-500">{val.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Buyer */}
          <Card title="Buyer">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div><p className="text-xs text-gray-400">Name (DL-010)</p><p className="font-semibold text-gray-900">{buyer.name}</p></div>
              <div><p className="text-xs text-gray-400">Sector</p><p className="font-medium text-gray-900">{buyer.sector}</p></div>
              <div><p className="text-xs text-gray-400">Rating</p><p className="font-medium text-gray-900">{buyer.rating} <span className="text-gray-400 text-xs">({buyer.rating_source})</span></p></div>
            </div>
          </Card>

          {/* Supplier */}
          <Card title="Supplier">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div><p className="text-xs text-gray-400">Name</p><p className="font-semibold text-gray-900">{supplier.name}</p></div>
              <div><p className="text-xs text-gray-400">Type</p><p className="font-medium text-gray-900">{supplier.constitution_type.replace('_', ' ')}</p></div>
            </div>
          </Card>
        </div>

        {/* ── Right column (2/5) — Subscription panel ─ */}
        <div className="lg:col-span-2">
          <div className="sticky top-4 flex flex-col gap-4">

            {/* Window closed */}
            {isWindowClosed && (
              <Card className="border-gray-200 bg-gray-50">
                <div className="text-center py-6">
                  <p className="font-semibold text-gray-600 mb-1">Funding Window Closed</p>
                  <p className="text-xs text-gray-400 mb-4">This listing is no longer accepting subscriptions (L.9/C12).</p>
                  <Button variant="ghost" onClick={() => navigate('/s11')}>Back to Listings</Button>
                </div>
              </Card>
            )}

            {/* No headroom */}
            {isNoHeadroom && (
              <Card className="border-gray-200 bg-gray-50">
                <div className="text-center py-6">
                  <p className="font-semibold text-gray-600 mb-1">No Capacity Remaining</p>
                  <p className="text-xs text-gray-400 mb-4">This listing is fully subscribed (G10/L.2).</p>
                  <Button variant="ghost" onClick={() => navigate('/s11')}>Back to Listings</Button>
                </div>
              </Card>
            )}

            {/* Not subscribed — subscription form */}
            {variant === 'not_subscribed' && (
              <Card title="Subscribe" subtitle="Minimum ₹10,000 per investment (DL-007)">
                <div className="flex flex-col gap-4">
                  <FormField
                    label="Investment Amount (₹)"
                    id="amount"
                    type="number"
                    placeholder="e.g. 10000"
                    value={amount}
                    onChange={e => { setAmount(e.target.value); setAmountErr('') }}
                    min={10000}
                  />
                  {amountErr && <p className="text-xs text-red-600">{amountErr}</p>}

                  {amtNum >= 10000 && (
                    <div className="p-3 bg-indigo-50 rounded-lg text-xs space-y-1">
                      <p className="font-medium text-indigo-800 mb-2">Return Illustration (pre-tax)</p>
                      <div className="flex justify-between text-gray-700"><span>Gross return</span><span>{formatRupees(grossReturn)}</span></div>
                      <div className="flex justify-between text-gray-700"><span>TDS (10%)</span><span>− {formatRupees(tdsAmt)}</span></div>
                      <div className="flex justify-between font-semibold text-indigo-900 border-t border-indigo-200 pt-1"><span>Net return</span><span>{formatRupees(netReturn)}</span></div>
                      <p className="text-gray-400 mt-1">TDS estimate only; actual per tax status. {/* TBD: show pre-commit or only post-distribution? */}</p>
                    </div>
                  )}

                  {/* Concentration advisory — non-blocking (DL-011) */}
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                    Advisory (DL-011): Ensure this investment does not exceed 20% of your deployed capital in a single buyer sector.
                  </div>

                  <Button onClick={handleCommit}>Commit Subscription</Button>
                  <Button variant="ghost" onClick={() => navigate('/s11')}>Back to Listings</Button>
                </div>
              </Card>
            )}

            {/* Committed — VA details */}
            {variant === 'committed' && (
              <Card title="Subscription Committed">
                <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Amount</span>
                    <span className="font-semibold text-gray-900">{subscription ? formatPaise(subscription.amount) : formatRupees(amtNum)}</span>
                  </div>
                  <StatusBadge label="Committed — Awaiting Funds" color="amber" />

                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-2 text-sm">
                    <p className="font-medium text-gray-900 mb-1">Transfer funds to Virtual Account (DL-009)</p>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 text-xs">VA Number</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-gray-900 text-xs">{vaNumber}</span>
                        <button onClick={handleCopy} className="text-indigo-600 text-xs hover:underline">{copied ? 'Copied!' : 'Copy'}</button>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 text-xs">IFSC</span>
                      <span className="font-mono text-gray-900 text-xs">{vaIfsc}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Transfer from your registered bank account only.</p>
                  </div>

                  <Button onClick={() => navigate('/s13')}>View My Portfolio →</Button>
                  <Button variant="ghost" className="text-red-600 border-red-200 hover:bg-red-50">Cancel Subscription</Button>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-8">Rules: DL-007/S.1 (₹10k min) · DL-009 (no wallet, VA transfer) · DL-010 (buyer disclosed) · DL-011/S.8 (concentration advisory) · L.9/C12 (window enforcement) · G10/L.2 (headroom check)</p>
    </div>
  )
}
