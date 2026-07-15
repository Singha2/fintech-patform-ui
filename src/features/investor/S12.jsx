import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import Button from '../../components/kit/Button.jsx'
import Card from '../../components/kit/Card.jsx'
import FormField from '../../components/kit/FormField.jsx'
import PageHeader from '../../components/kit/PageHeader.jsx'
import StatusBadge from '../../components/kit/StatusBadge.jsx'
import { formatPaise, formatRupees, formatRate, formatDate, formatDatetime, fundingPct } from '../../utils/format.js'
import mockData from '../../data/mockData.js'

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

export default function S12() {
  const navigate = useNavigate()
  const location = useLocation()
  const { listing, invoice, buyer, supplier } = mockData.S12
  const selectedId = location.state?.listingId ?? listing.listing_id
  const s11Listing = mockData.S11.listings.find(l => l.listing_id === selectedId) ?? {}

  const [variant, setVariant] = useState('not_subscribed')
  const [amount, setAmount] = useState('')
  const [subscription, setSubscription] = useState(null)
  const [copied, setCopied] = useState(false)
  const [amountErr, setAmountErr] = useState('')

  const rateBps = listing.pricing_snapshot.rate_bps
  const feeBps = listing.pricing_snapshot.fee_bps
  const tenorDays = invoice.tenor_days
  const amtNum = parseFloat(amount) || 0
  const grossReturn = amtNum * (rateBps / 10000) * (tenorDays / 365)
  const tdsAmt = grossReturn * 0.10
  const netReturn = grossReturn - tdsAmt
  const pct = fundingPct(listing.committed_total, listing.funding_target)

  function handleCommit() {
    if (amtNum < 10000) { setAmountErr('Minimum investment is ₹10,000 (DL-007).'); return }
    if (listing.committed_total + amtNum * 100 > listing.funding_target) { setAmountErr('Amount exceeds remaining headroom (G10/L.2).'); return }
    setAmountErr('')
    setSubscription({ subscription_id: 'sub-new', amount: amtNum * 100, status: 'committed' })
    setVariant('committed')
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
        title={s11Listing.buyer_name ?? listing.listing_id}
        subtitle={`Listing ${listing.listing_id} · ${s11Listing.buyer_sector ?? ''}`}
      />

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
              <div><p className="text-xs text-gray-400">Funding Target</p><p className="font-semibold text-gray-900">{formatPaise(listing.funding_target)}</p></div>
              <div><p className="text-xs text-gray-400">Committed</p><p className="font-semibold text-gray-900">{formatPaise(listing.committed_total)}</p></div>
              <div><p className="text-xs text-gray-400">Rate</p><p className="font-semibold text-gray-900">{formatRate(rateBps)}</p></div>
              <div><p className="text-xs text-gray-400">Platform Fee</p><p className="font-semibold text-gray-900">{(feeBps / 100).toFixed(2)}%</p></div>
            </div>
            <div className="mb-1 flex justify-between text-xs text-gray-400">
              <span>Funding progress</span><span>{pct}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
              <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs text-gray-400">Window closes {formatDate(listing.funding_window_close_at)} · Pricing snapshot {formatDatetime(listing.pricing_snapshot.snapshot_at)}</p>
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
              <p className="font-mono text-xs text-gray-700 break-all">{invoice.irn.slice(0, 24)}…</p>
            </div>
            <div className="overflow-x-auto rounded-lg border border-gray-100">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50"><tr>
                  <th className="px-3 py-2 text-left text-gray-500 font-medium">Check</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-medium">Result</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-medium">Detail</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {Object.entries(invoice.check_outcomes).map(([key, val]) => (
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
                        <span className="font-mono text-gray-900 text-xs">{listing.virtual_account_number}</span>
                        <button onClick={handleCopy} className="text-indigo-600 text-xs hover:underline">{copied ? 'Copied!' : 'Copy'}</button>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 text-xs">IFSC</span>
                      <span className="font-mono text-gray-900 text-xs">{listing.virtual_account_ifsc}</span>
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
