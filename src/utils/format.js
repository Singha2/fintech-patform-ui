const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatPaise(paise) {
  return INR.format(paise / 100)
}

export function formatRupees(rupees) {
  return INR.format(rupees)
}

export function formatRate(bps) {
  return (bps / 100).toFixed(2) + '% p.a.'
}

export function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDatetime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function fundingPct(committed, target) {
  if (!target) return 0
  return Math.min(100, Math.round((committed / target) * 100))
}
