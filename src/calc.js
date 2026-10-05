export const CURRENCIES = {
  INR: { label: 'INR (₹)', sym: '₹', pdf: 'Rs. ', loc: 'en-IN' },
  USD: { label: 'USD ($)', sym: '$', pdf: '$', loc: 'en-US' },
  EUR: { label: 'EUR (€)', sym: '€', pdf: '€', loc: 'en-US' },
  GBP: { label: 'GBP (£)', sym: '£', pdf: '£', loc: 'en-GB' }
}

export const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n }

// forPdf: jsPDF's built-in fonts can't draw ₹, so the PDF uses "Rs. "
export function fmt(n, cur, forPdf = false) {
  const c = CURRENCIES[cur]
  const body = Math.abs(n).toLocaleString(c.loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return (n < 0 ? '-' : '') + (forPdf ? c.pdf : c.sym) + body
}

export function calc(s) {
  let sub = 0, itemDisc = 0
  const groups = {}
  const rows = s.items.map((it) => {
    const base = num(it.qty) * num(it.rate)
    const disc = (base * num(it.discount)) / 100
    const taxable = base - disc
    const rate = s.taxMode === 'none' ? 0 : num(it.tax)
    const tax = (taxable * rate) / 100
    sub += base; itemDisc += disc
    if (rate) groups[rate] = (groups[rate] || 0) + taxable
    return { ...it, base, taxable, tax, amount: taxable + tax }
  })

  const taxLines = []
  Object.entries(groups).forEach(([r, base]) => {
    const rate = Number(r)
    if (s.taxMode === 'gst' && s.gstType === 'igst') {
      taxLines.push({ label: `IGST ${rate}%`, amount: (base * rate) / 100 })
    } else if (s.taxMode === 'gst') {
      const half = (base * rate) / 200
      taxLines.push({ label: `CGST ${rate / 2}%`, amount: half }, { label: `SGST ${rate / 2}%`, amount: half })
    } else {
      taxLines.push({ label: `${s.customLabel || 'Tax'} ${rate}%`, amount: (base * rate) / 100 })
    }
  })

  const tax = taxLines.reduce((a, l) => a + l.amount, 0)
  const disc = itemDisc + num(s.extra.discount)
  const grand = sub - disc + tax + num(s.extra.shipping) + num(s.extra.other) + num(s.extra.roundOff)
  return { rows, sub, disc, taxLines, tax, grand }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export function validate(s) {
  const e = []
  if (!s.biz.name.trim()) e.push('Business name is required.')
  if (!s.cust.name.trim()) e.push('Customer name is required.')
  if (!s.inv.number.trim()) e.push('Invoice number is required.')
  if (!s.inv.date) e.push('Invoice date is required.')
  if (!s.items.length) e.push('Add at least one invoice item.')
  if (s.biz.email && !EMAIL.test(s.biz.email)) e.push('Your business email is not a valid address.')
  if (s.cust.email && !EMAIL.test(s.cust.email)) e.push('Customer email is not a valid address.')
  s.items.forEach((it, i) => {
    const n = `Item ${i + 1}`
    if (!(num(it.qty) > 0)) e.push(`${n}: quantity must be greater than 0.`)
    if (num(it.rate) < 0) e.push(`${n}: rate cannot be negative.`)
    if (num(it.tax) < 0) e.push(`${n}: tax cannot be negative.`)
    if (num(it.discount) < 0) e.push(`${n}: discount cannot be negative.`)
  })
  if (num(s.extra.discount) < 0) e.push('Extra discount cannot be negative.')
  return e
}
