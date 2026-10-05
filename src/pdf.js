import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { calc, fmt, num } from './calc'

const THEME = {
  classic: { font: 'times', accent: [30, 41, 59], head: [241, 245, 249], headText: [30, 41, 59], theme: 'grid' },
  modern: { font: 'helvetica', accent: [79, 70, 229], head: [79, 70, 229], headText: [255, 255, 255], theme: 'striped' },
  minimal: { font: 'helvetica', accent: [0, 0, 0], head: [255, 255, 255], headText: [0, 0, 0], theme: 'plain' }
}
const addr = (p) => [p.address, [p.city, p.state, p.zip].filter(Boolean).join(', '), p.country].filter(Boolean)
const date = (v) => v ? new Date(v + 'T00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''

// Real vector PDF (A4), drawn with jsPDF — not a screenshot of the page.
export function buildPdf(s) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const T = THEME[s.template], c = calc(s), f = (n) => fmt(n, s.inv.currency, true)
  const { biz, cust, inv, pay } = s
  const M = 15, R = 195
  let y = M

  const txt = (t, x, yy, o = {}) => {
    doc.setFont(T.font, o.b ? 'bold' : 'normal')
    doc.setFontSize(o.size || 9)
    doc.setTextColor(...(o.color || [40, 40, 40]))
    doc.text(String(t), x, yy, { align: o.align || 'left' })
  }
  const need = (h) => { if (y + h > 285) { doc.addPage(); y = M } }
  const block = (title, lines) => {
    if (!lines.length) return
    need(12); txt(title, M, y, { b: 1, size: 8, color: T.accent }); y += 5
    lines.forEach((l) => { need(5); txt(l, M, y); y += 4.5 })
    y += 4
  }

  // Header: business (left) / invoice meta (right)
  let ly = M, lo = 0
  if (biz.logo) {
    const ratio = biz.logo.w / biz.logo.h, w = Math.min(22 * ratio, 55), h = w / ratio
    doc.addImage(biz.logo.src, 'PNG', R - w, M, w, h); lo = h + 3
  }
  txt(biz.name, M, ly + 4, { b: 1, size: 13 }); ly += 9
  ;[...addr(biz), [biz.phone, biz.email, biz.website].filter(Boolean).join(' | '),
    biz.gstin && `GSTIN: ${biz.gstin}`, biz.pan && `PAN: ${biz.pan}`].filter(Boolean)
    .forEach((l) => { txt(l, M, ly); ly += 4.5 })

  txt('INVOICE', R, M + 6 + lo, { b: 1, size: 22, align: 'right', color: T.accent })
  let ry = M + 14 + lo
  ;[`#${inv.number}`, `Date: ${date(inv.date)}`, inv.due && `Due: ${date(inv.due)}`,
    inv.po && `PO: ${inv.po}`, inv.ref && `Ref: ${inv.ref}`].filter(Boolean)
    .forEach((l) => { txt(l, R, ry, { align: 'right' }); ry += 5 })

  y = Math.max(ly, ry) + 3
  doc.setDrawColor(...T.accent); doc.line(M, y, R, y); y += 7

  // Bill to
  txt('BILL TO', M, y, { b: 1, size: 8, color: T.accent }); y += 5
  txt(cust.name, M, y, { b: 1, size: 10 }); y += 5
  ;[cust.company, ...addr(cust), [cust.email, cust.phone].filter(Boolean).join(' | '),
    cust.gstin && `GSTIN: ${cust.gstin}`].filter(Boolean)
    .forEach((l) => { txt(l, M, y); y += 4.5 })
  y += 5

  // Items
  autoTable(doc, {
    startY: y, margin: { left: M, right: M }, theme: T.theme,
    head: [['Item', 'Qty', 'Rate', 'Disc %', 'Tax %', 'Amount']],
    body: c.rows.map((r) => [
      r.name + (r.desc ? '\n' + r.desc : ''), r.qty, f(num(r.rate)),
      num(r.discount), s.taxMode === 'none' ? '-' : num(r.tax), f(r.amount)
    ]),
    styles: { font: T.font, fontSize: 9, cellPadding: 2.5, textColor: [40, 40, 40], lineColor: [210, 214, 220] },
    headStyles: { fillColor: T.head, textColor: T.headText, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } }
  })
  y = doc.lastAutoTable.finalY + 7

  // Totals
  const rows = [['Subtotal', f(c.sub)], ['Discount', f(-c.disc)], ...c.taxLines.map((l) => [l.label, f(l.amount)])]
  if (num(s.extra.shipping)) rows.push(['Shipping', f(num(s.extra.shipping))])
  if (num(s.extra.other)) rows.push(['Other Charges', f(num(s.extra.other))])
  if (num(s.extra.roundOff)) rows.push(['Round Off', f(num(s.extra.roundOff))])
  rows.forEach(([l, v]) => { need(6); txt(l, 130, y); txt(v, R, y, { align: 'right' }); y += 5.5 })
  need(12); doc.line(130, y - 2, R, y - 2); y += 3
  txt('GRAND TOTAL', 130, y, { b: 1, size: 11, color: T.accent })
  txt(f(c.grand), R, y, { b: 1, size: 11, align: 'right', color: T.accent }); y += 12

  // Footer blocks
  if (s.payOn) {
    block('PAYMENT DETAILS', [
      pay.bank && `Bank: ${pay.bank}`, pay.accName && `Account Name: ${pay.accName}`,
      pay.accNo && `Account No: ${pay.accNo}`, pay.ifsc && `IFSC: ${pay.ifsc}`,
      pay.upi && `UPI: ${pay.upi}`, ...(pay.instr ? doc.splitTextToSize(pay.instr, R - M) : [])
    ].filter(Boolean))
  }
  if (s.notes) block('NOTES', doc.splitTextToSize(s.notes, R - M))
  if (s.terms) block('TERMS & CONDITIONS', doc.splitTextToSize(s.terms, R - M))
  return doc
}
