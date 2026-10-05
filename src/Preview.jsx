import React from 'react'
import { calc, fmt } from './calc'

const addr = p => [p.address, [p.city, p.state, p.zip].filter(Boolean).join(', '), p.country].filter(Boolean)
const date = v => v ? new Date(v + 'T00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''

export default function Preview({ s }) {
  const c = calc(s), f = n => fmt(n, s.inv.currency), { biz, cust, inv, pay } = s
  return <div id="invoice" className={`sheet t-${s.template}`}>
    <div className="invoice-header">
      <div className="brand-block">
        {biz.logo && <img className="invoice-logo" src={biz.logo.src} alt="Logo" />}
        <div className="business-name">{biz.name || 'YOUR BUSINESS'}</div>
        {addr(biz).map((x,i)=><div key={i}>{x}</div>)}
        <div>{[biz.phone, biz.email, biz.website].filter(Boolean).join(' · ')}</div>
        {biz.gstin && <div>GSTIN: {biz.gstin}</div>}
        {biz.pan && <div>PAN: {biz.pan}</div>}
      </div>
      <div className="invoice-meta"><div className="invoice-title">INVOICE</div><div><span>Invoice No.</span><b>#{inv.number}</b></div><div><span>Invoice Date</span><b>{date(inv.date)}</b></div>{inv.due && <div><span>Due Date</span><b>{date(inv.due)}</b></div>}{inv.po && <div><span>PO Number</span><b>{inv.po}</b></div>}{inv.ref && <div><span>Reference</span><b>{inv.ref}</b></div>}</div>
    </div>

    <div className="invoice-rule" />
    <div className="bill-grid"><div><small>BILLED TO</small><strong>{cust.name || 'Customer Name'}</strong>{cust.company && <div>{cust.company}</div>}{addr(cust).map((x,i)=><div key={i}>{x}</div>)}{[cust.email,cust.phone].filter(Boolean).length>0 && <div>{[cust.email,cust.phone].filter(Boolean).join(' · ')}</div>}{cust.gstin && <div>GSTIN: {cust.gstin}</div>}</div></div>

    <table className="invoice-table"><thead><tr><th className="left">ITEM / DESCRIPTION</th><th>HSN/SAC</th><th>QTY</th><th>RATE</th><th>DISC.</th><th>TAX</th><th>AMOUNT</th></tr></thead><tbody>{c.rows.map((r,i)=><tr key={r.id}><td className="left"><strong>{r.name || `Item ${i+1}`}</strong>{r.desc && <div className="item-desc">{r.desc}</div>}</td><td>{r.hsn || '—'}</td><td>{r.qty}</td><td>{f(r.rate)}</td><td>{Number(r.discount||0)}%</td><td>{s.taxMode === 'none' ? '—' : `${Number(r.tax||0)}%`}</td><td>{f(r.amount)}</td></tr>)}</tbody></table>

    <div className="lower-grid">
      <div className="payment-block">{s.payOn && <><small>PAYMENT DETAILS</small>{pay.bank && <div><b>Bank</b>{pay.bank}</div>}{pay.accName && <div><b>Account Name</b>{pay.accName}</div>}{pay.accNo && <div><b>Account No.</b>{pay.accNo}</div>}{pay.ifsc && <div><b>IFSC</b>{pay.ifsc}</div>}{pay.upi && <div><b>UPI</b>{pay.upi}</div>}{pay.instr && <p className="payment-note">{pay.instr}</p>}</>}</div>
      <div className="totals"><div><span>Subtotal</span><b>{f(c.sub)}</b></div>{c.disc>0&&<div><span>Discount</span><b>- {f(c.disc)}</b></div>}{c.taxLines.map(l=><div key={l.label}><span>{l.label}</span><b>{f(l.amount)}</b></div>)}{Number(s.extra.shipping)>0&&<div><span>Shipping</span><b>{f(Number(s.extra.shipping))}</b></div>}{Number(s.extra.other)>0&&<div><span>Other Charges</span><b>{f(Number(s.extra.other))}</b></div>}{Number(s.extra.roundOff)!==0&&<div><span>Round Off</span><b>{f(Number(s.extra.roundOff))}</b></div>}<div className="grand"><span>GRAND TOTAL</span><b>{f(c.grand)}</b></div></div>
    </div>

    <div className="footer-grid">{s.notes&&<div><small>NOTES</small><p>{s.notes}</p></div>}{s.terms&&<div><small>TERMS & CONDITIONS</small><p>{s.terms}</p></div>}</div>
    <div className="thankyou">THANK YOU<div>FOR BEING A PART OF OUR JOURNEY</div></div>
  </div>
}
