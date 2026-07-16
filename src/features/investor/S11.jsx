import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/kit/Button.jsx'
import Card from '../../components/kit/Card.jsx'
import PageHeader from '../../components/kit/PageHeader.jsx'
import StatusBadge from '../../components/kit/StatusBadge.jsx'
import { formatPaise, formatRate, formatDate, fundingPct } from '../../utils/format.js'
import { useStore } from '../../store/PlatformStore.jsx'

const VARIANTS = [
  { id: 'normal',             label: 'Normal' },
  { id: 'empty_marketplace',  label: 'Empty Marketplace' },
  { id: 'investor_suspended', label: 'Investor Suspended' },
]

function sectorColor(sector) {
  const map = { Energy: 'amber', Manufacturing: 'gray', Technology: 'purple' }
  return map[sector] ?? 'gray'
}

function ListingCard({ listing, onClick, disabled }) {
  const pct = fundingPct(listing.committed_total, listing.funding_target)
  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={`bg-white rounded-xl border p-5 transition-all ${
        disabled
          ? 'border-gray-200 opacity-50 cursor-not-allowed'
          : 'border-gray-200 hover:border-indigo-400 hover:shadow-md cursor-pointer'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="font-semibold text-gray-900 text-sm">{listing.buyer_name}</p>
          <p className="text-xs text-gray-500 mt-0.5">{listing.supplier_name}</p>
        </div>
        <div className="flex gap-1.5 flex-wrap justify-end">
          <StatusBadge label={listing.status === 'live' ? 'Live' : 'Fully Funded'} color={listing.status === 'live' ? 'green' : 'gray'} />
          {listing.investor_subscribed && <StatusBadge label="Invested" color="purple" />}
          <StatusBadge label={listing.buyer_sector} color={sectorColor(listing.buyer_sector)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-gray-600 mb-3">
        <div><span className="text-gray-400">Target</span><p className="font-medium text-gray-900">{formatPaise(listing.funding_target)}</p></div>
        <div><span className="text-gray-400">Rate</span><p className="font-medium text-gray-900">{formatRate(listing.rate_bps)}</p></div>
        <div><span className="text-gray-400">Tenor</span><p className="font-medium text-gray-900">{listing.tenor_days} days</p></div>
        <div><span className="text-gray-400">Due date</span><p className="font-medium text-gray-900">{formatDate(listing.due_date)}</p></div>
      </div>

      {/* Funding progress bar */}
      <div className="mb-1 flex justify-between text-xs text-gray-400">
        <span>Funded</span><span>{pct}%</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div className="bg-indigo-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-gray-400 mt-1">Window closes {formatDate(listing.funding_window_close_at)}</p>
    </div>
  )
}

export default function S11() {
  const navigate = useNavigate()
  const { marketplaceListings } = useStore()
  const [variant, setVariant] = useState('normal')
  // Live + fully-funded listings from the shared store — so a go-live approved on S5 shows up here (G-D3).
  const listings = marketplaceListings()

  return (
    <div>
      <PageHeader title="Listing Marketplace" subtitle="Browse live invoice listings available for investment" />

      <div className="flex items-center gap-2 flex-wrap mb-6">
        <span className="text-xs text-gray-400">Preview state:</span>
        {VARIANTS.map(v => (
          <button key={v.id} onClick={() => setVariant(v.id)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${variant === v.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-300 hover:border-indigo-400'}`}>
            {v.label}
          </button>
        ))}
      </div>

      {/* Investor suspended banner */}
      {variant === 'investor_suspended' && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex gap-3 items-start">
          <span className="text-red-500 text-lg">⚠</span>
          <div>
            <p className="font-semibold text-red-800 text-sm">Account Suspended</p>
            <p className="text-sm text-red-700">Your investor account has been suspended. Contact support to resolve.</p>
          </div>
        </div>
      )}

      {/* Filter bar — rendered but not functional in mock */}
      <div className="flex gap-3 flex-wrap mb-6">
        {[['Sector', ['All', 'Energy', 'Manufacturing', 'Technology']], ['Tenor', ['All', '<30d', '30–60d', '60–90d', '90d+']]].map(([label, opts]) => (
          <div key={label} className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{label}:</span>
            <select className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 focus:outline-none">
              {opts.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
        ))}
        <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
          <input type="checkbox" className="rounded" />
          Show fully funded
        </label>
      </div>

      {variant === 'empty_marketplace' ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-gray-500 text-sm mb-1">No live listings available right now.</p>
            <p className="text-xs text-gray-400">Check back soon — new listings are added regularly.</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {listings.map(listing => (
            <ListingCard
              key={listing.listing_id}
              listing={listing}
              disabled={listing.status === 'fully_funded' || variant === 'investor_suspended'}
              onClick={() => navigate('/s12', { state: { listingId: listing.listing_id } })}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-8">Rules: DL-010 (buyer disclosed) · DL-011 (concentration advisory) · L.9/C12 (past window not subscribable) · X14/G19 (tenant isolation)</p>
    </div>
  )
}
