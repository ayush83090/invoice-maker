import { useEffect, useRef, useState } from 'react'
import { calc, fmt } from './calc'

const W = 700 // invoice is laid out at a fixed width, then scaled to fit the screen

const addr = (p) => [p.address, [p.city, p.state, p.zip].filter(Boolean).join(', '), p.country].filter(Boolean)
const date = (v) => v ? new Date(v + 'T00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''

export default function Preview({ s }) {
  const wrap = useRef(null)
  const [k, setK] = useState(1)
  useEffect(() => {
    const el = wrap.current
    const fit = () => setK(Math.min(1, el.clientWidth / W))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const c = calc(s), f = (n) => fmt(n, s.inv.currency)
  const { biz, cust, inv, pay } = s
  const payLines = [
    pay.bank && `Bank: ${pay.bank}`, pay.accName && `Account Name: ${pay.accName}`,
    pay.accNo && `Account No: ${pay.accNo}`, pay.ifsc && `IFSC: ${pay.ifsc}`, pay.upi && `UPI: ${pay.upi}`
  ].filter(Boolean)

  return (
    <div ref={wrap} className="fit">
    <div id="invoice" className={`sheet t-${s.template}`} style={{ zoom: k }}>
      <div className="ih">
        <div>
          <h3>{biz.name || 'Your Business'}</h3>
          {addr(biz).map((l, i) => <p key={i}>{l}</p>)}
          <p>{[biz.phone, biz.email, biz.website].filter(Boolean).join(' | ')}</p>
          {biz.gstin && <p>GSTIN: {biz.gstin}</p>}
          {biz.pan && <p>PAN: {biz.pan}</p>}
        </div>
        <div className="meta">
          {biz.logo && <img className="logo" src={biz.logo.src} alt="Logo" />}
          <h1>INVOICE</h1>
          <p><b>#{inv.number}</b></p>
          <p>Date: {date(inv.date)}</p>
          {inv.due && <p>Due: {date(inv.due)}</p>}
          {inv.po && <p>PO: {inv.po}</p>}
          {inv.ref && <p>Ref: {inv.ref}</p>}
        </div>
      </div>

      <div className="bill">
        <small>BILL TO</small>
        <p><b>{cust.name || 'Customer Name'}</b></p>
        {cust.company && <p>{cust.company}</p>}
        {addr(cust).map((l, i) => <p key={i}>{l}</p>)}
        <p>{[cust.email, cust.phone].filter(Boolean).join(' | ')}</p>
        {cust.gstin && <p>GSTIN: {cust.gstin}</p>}
      </div>

      <div className="tw">
        <table>
          <thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Disc</th><th>Tax</th><th>Amount</th></tr></thead>
          <tbody>
            {c.rows.map((r) => (
              <tr key={r.id}>
                <td><b>{r.name || '—'}</b>{r.desc && <div className="d">{r.desc}</div>}</td>
                <td>{r.qty}</td><td>{f(+r.rate || 0)}</td><td>{+r.discount || 0}%</td>
                <td>{s.taxMode === 'none' ? '-' : `${+r.tax || 0}%`}</td><td>{f(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="totals">
        <div><span>Subtotal</span><span>{f(c.sub)}</span></div>
        <div><span>Discount</span><span>{f(-c.disc)}</span></div>
        {c.taxLines.map((l) => <div key={l.label}><span>{l.label}</span><span>{f(l.amount)}</span></div>)}
        {+s.extra.shipping ? <div><span>Shipping</span><span>{f(+s.extra.shipping)}</span></div> : null}
        {+s.extra.other ? <div><span>Other Charges</span><span>{f(+s.extra.other)}</span></div> : null}
        {+s.extra.roundOff ? <div><span>Round Off</span><span>{f(+s.extra.roundOff)}</span></div> : null}
        <div className="grand"><span>GRAND TOTAL</span><span>{f(c.grand)}</span></div>
      </div>

      {s.payOn && (payLines.length > 0 || pay.instr) && (
        <div className="blk"><small>PAYMENT DETAILS</small>{payLines.map((l, i) => <p key={i}>{l}</p>)}{pay.instr && <p>{pay.instr}</p>}</div>
      )}
      {s.notes && <div className="blk"><small>NOTES</small><p>{s.notes}</p></div>}
      {s.terms && <div className="blk"><small>TERMS &amp; CONDITIONS</small><p>{s.terms}</p></div>}
    </div>
    </div>
  )
}
