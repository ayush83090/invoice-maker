import { useState } from 'react'
import Preview from './Preview'
import { CURRENCIES, calc, fmt, validate } from './calc'
import { buildPdf } from './pdf'

const iso = (add = 0) => { const d = new Date(); d.setDate(d.getDate() + add); return d.toISOString().slice(0, 10) }
const newItem = (tax) => ({ id: Math.random().toString(36).slice(2), name: '', desc: '', qty: 1, rate: 0, discount: 0, tax })
const initial = () => ({
  template: 'classic',
  biz: { name: '', logo: null, email: '', phone: '', website: '', address: '', city: '', state: '', country: 'India', zip: '', gstin: '', pan: '' },
  cust: { name: '', company: '', email: '', phone: '', address: '', city: '', state: '', country: 'India', zip: '', gstin: '' },
  inv: { number: 'INV-001', date: iso(), due: iso(15), po: '', ref: '', currency: 'INR' },
  items: [newItem(18)],
  taxMode: 'gst', gstType: 'split', taxRate: 18, customLabel: 'Tax',
  extra: { shipping: 0, other: 0, discount: 0, roundOff: 0 },
  payOn: true, pay: { bank: '', accName: '', accNo: '', ifsc: '', upi: '', instr: '' },
  notes: 'Thank you for your business.', terms: 'Payment is due within 15 days.'
})

const BIZ = [['name', 'Business / Company Name'], ['email', 'Email', 'email'], ['phone', 'Phone'], ['website', 'Website'], ['address', 'Address'], ['city', 'City'], ['state', 'State'], ['country', 'Country'], ['zip', 'ZIP / PIN'], ['gstin', 'GSTIN'], ['pan', 'PAN']]
const CUST = [['name', 'Customer Name'], ['company', 'Company Name'], ['email', 'Email', 'email'], ['phone', 'Phone'], ['address', 'Address'], ['city', 'City'], ['state', 'State'], ['country', 'Country'], ['zip', 'ZIP / PIN'], ['gstin', 'GSTIN']]
const INV = [['number', 'Invoice Number'], ['date', 'Invoice Date', 'date'], ['due', 'Due Date', 'date'], ['po', 'PO Number'], ['ref', 'Reference Number']]
const PAY = [['bank', 'Bank Name'], ['accName', 'Account Name'], ['accNo', 'Account Number'], ['ifsc', 'IFSC'], ['upi', 'UPI ID']]
const EXTRA = [['shipping', 'Shipping'], ['other', 'Other Charges'], ['discount', 'Discount (flat)'], ['roundOff', 'Round Off (+/−)']]
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function Card({ title, children }) { return <section className="card"><h2>{title}</h2>{children}</section> }
function Fields({ list, obj, onChange }) {
  return (
    <div className="grid">
      {list.map(([k, label, type = 'text']) => (
        <label key={k}>{label}
          <input type={type} step={type === 'number' ? 'any' : undefined} value={obj[k]} onChange={(e) => onChange(k, e.target.value)} />
        </label>
      ))}
    </div>
  )
}

export default function App() {
  const [s, setS] = useState(initial)
  const [errors, setErrors] = useState([])
  const [generated, setGenerated] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)
  const [mailOpen, setMailOpen] = useState(false)
  const [mail, setMail] = useState({ to: '', subject: '', message: 'Please find your invoice attached.' })

  const up = (g, k, v) => setS((p) => ({ ...p, [g]: { ...p[g], [k]: v } }))
  const top = (k, v) => setS((p) => ({ ...p, [k]: v }))
  const setItem = (id, k, v) => setS((p) => ({ ...p, items: p.items.map((i) => (i.id === id ? { ...i, [k]: v } : i)) }))
  const show = (m, t = 'ok') => { setToast({ m, t }); setTimeout(() => setToast(null), 3200) }
  const total = fmt(calc(s).grand, s.inv.currency)
  const fname = `Invoice-${s.inv.number.replace(/[\\/:*?"<>|\s]+/g, '-')}.pdf`

  // Logo: resized client-side so it always fits the invoice
  const onLogo = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const k = Math.min(1, 400 / img.width, 200 / img.height)
        const cv = document.createElement('canvas')
        cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k)
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height)
        up('biz', 'logo', { src: cv.toDataURL('image/png'), w: cv.width, h: cv.height })
      }
      img.onerror = () => show('That file is not a valid image.', 'error')
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  }

  const guard = () => { const e = validate(s); setErrors(e); if (e.length) { show(`Please fix ${e.length} issue(s) first: ${e[0]}`, 'error'); window.scrollTo({ top: 0, behavior: 'smooth' }) } return !e.length }
  const run = async (fn) => {
    setBusy(true)
    try { await new Promise((r) => setTimeout(r, 30)); await fn() }
    catch (x) { show(x.message || 'Something went wrong.', 'error') }
    finally { setBusy(false) }
  }

  const generate = () => { if (guard()) { setGenerated(true); show('Invoice ready. Download, print or email it.'); document.getElementById('invoice')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) } }
  const download = () => guard() && run(async () => { buildPdf(s).save(fname); show('PDF downloaded.') })
  const print = () => guard() && window.print()
  const openMail = () => {
    if (!guard()) return
    setMail((m) => ({ ...m, to: m.to || s.cust.email, subject: `Invoice ${s.inv.number}` }))
    setMailOpen(true)
  }
  const send = () => run(async () => {
    if (!EMAIL_RE.test(mail.to)) throw new Error('Enter a valid recipient email.')
    const pdf = buildPdf(s).output('datauristring').split(',')[1]
    const r = await fetch('/api/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...mail, filename: fname, pdf }) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(j.error || 'Email failed. Is the email server running?')
    show('Email sent.'); setMailOpen(false)
  })

  const reset = () => { if (window.confirm('Are you sure you want to clear this invoice?')) { setS(initial()); setErrors([]); setGenerated(false); show('Invoice cleared.') } }
  const saveDraft = () => { try { localStorage.setItem('invoice-draft', JSON.stringify(s)); show('Draft saved in this browser.') } catch { show('Could not save draft.', 'error') } }
  const restoreDraft = () => {
    try { const d = localStorage.getItem('invoice-draft'); if (!d) return show('No saved draft found.', 'error'); setS(JSON.parse(d)); show('Draft restored.') }
    catch { show('Could not restore draft.', 'error') }
  }

  return (
    <div className="app">
      <header className="top">
        <div><h1>Invoice Maker</h1><p>Create professional invoices in minutes.</p></div>
        <div className="seg">
          {['classic', 'modern', 'minimal'].map((t) => (
            <button key={t} className={s.template === t ? 'on' : ''} onClick={() => top('template', t)}>{t[0].toUpperCase() + t.slice(1)}</button>
          ))}
        </div>
      </header>

      <div className="actions">
        <button className="btn primary" onClick={generate}>Generate Invoice</button>
        <button className="btn" disabled={busy} onClick={download}>{busy ? 'Generating…' : 'Download PDF'}</button>
        <button className="btn" onClick={print}>Print</button>
        <button className="btn" onClick={openMail}>Send by Email</button>
        <span className="sp" />
        <button className="btn ghost" onClick={saveDraft}>Save Draft</button>
        <button className="btn ghost" onClick={restoreDraft}>Restore Draft</button>
        <button className="btn danger" onClick={reset}>Clear / Reset</button>
      </div>

      {errors.length > 0 && <div className="errs"><b>Please fix the following:</b><ul>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul></div>}

      <main className="layout">
        <div className="form">
          <Card title="Your Business">
            <div className="logo-row">
              {s.biz.logo ? <img src={s.biz.logo.src} alt="Logo" /> : <div className="ph">No logo</div>}
              <label className="btn small">{s.biz.logo ? 'Change logo' : 'Upload logo'}
                <input hidden type="file" accept="image/*" onChange={(e) => { onLogo(e.target.files[0]); e.target.value = '' }} />
              </label>
              {s.biz.logo && <button className="btn small danger" onClick={() => up('biz', 'logo', null)}>Remove</button>}
            </div>
            <Fields list={BIZ} obj={s.biz} onChange={(k, v) => up('biz', k, v)} />
          </Card>

          <Card title="Bill To"><Fields list={CUST} obj={s.cust} onChange={(k, v) => up('cust', k, v)} /></Card>

          <Card title="Invoice Details">
            <div className="grid">
              {INV.map(([k, label, type = 'text']) => (
                <label key={k}>{label}<input type={type} value={s.inv[k]} onChange={(e) => up('inv', k, e.target.value)} /></label>
              ))}
              <label>Currency
                <select value={s.inv.currency} onChange={(e) => up('inv', 'currency', e.target.value)}>
                  {Object.entries(CURRENCIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </label>
            </div>
          </Card>

          <Card title="Items">
            {s.items.length === 0 ? (
              <div className="empty">No items yet. Click “+ Add Item” to add your first one.</div>
            ) : (
              <div className="tw">
                <table className="items">
                  <thead><tr><th>Item</th><th>Description</th><th>Qty</th><th>Rate</th><th>Discount %</th><th>Tax %</th><th>Amount</th><th /></tr></thead>
                  <tbody>
                    {calc(s).rows.map((r) => (
                      <tr key={r.id}>
                        <td className="wide" data-label="Item"><input value={r.name} placeholder="Item name" onChange={(e) => setItem(r.id, 'name', e.target.value)} /></td>
                        <td className="wide" data-label="Description"><input value={r.desc} placeholder="Description" onChange={(e) => setItem(r.id, 'desc', e.target.value)} /></td>
                        {['qty', 'rate', 'discount', 'tax'].map((k) => (
                          <td key={k} data-label={{ qty: 'Qty', rate: 'Rate', discount: 'Discount %', tax: 'Tax %' }[k]}><input className="n" type="number" step="any" value={r[k]} onChange={(e) => setItem(r.id, k, e.target.value)} /></td>
                        ))}
                        <td className="amt wide" data-label="Amount">{fmt(r.amount, s.inv.currency)}</td>
                        <td className="wide"><button className="x" title="Remove item" onClick={() => setS((p) => ({ ...p, items: p.items.filter((i) => i.id !== r.id) }))}>×</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <button className="btn small" onClick={() => setS((p) => ({ ...p, items: [...p.items, newItem(p.taxRate)] }))}>+ Add Item</button>
          </Card>

          <Card title="Tax Options">
            <div className="radios">
              {[['none', 'No Tax'], ['gst', 'GST'], ['custom', 'Custom']].map(([v, l]) => (
                <label key={v}><input type="radio" checked={s.taxMode === v} onChange={() => top('taxMode', v)} /> {l}</label>
              ))}
            </div>
            {s.taxMode !== 'none' && (
              <div className="grid">
                {s.taxMode === 'gst' && (
                  <label>GST type
                    <select value={s.gstType} onChange={(e) => top('gstType', e.target.value)}>
                      <option value="split">CGST + SGST (same state)</option>
                      <option value="igst">IGST (different state)</option>
                    </select>
                  </label>
                )}
                {s.taxMode === 'custom' && <label>Tax name<input value={s.customLabel} onChange={(e) => top('customLabel', e.target.value)} /></label>}
                <label>Tax rate %
                  <input type="number" step="any" list="slabs" value={s.taxRate} onChange={(e) => top('taxRate', e.target.value)} />
                  <datalist id="slabs">{[0, 5, 12, 18, 28].map((n) => <option key={n} value={n} />)}</datalist>
                </label>
                <label>&nbsp;<button className="btn small" onClick={() => setS((p) => ({ ...p, items: p.items.map((i) => ({ ...i, tax: p.taxRate })) }))}>Apply to all items</button></label>
              </div>
            )}
          </Card>

          <Card title="Additional Charges">
            <div className="grid">
              {EXTRA.map(([k, label]) => (
                <label key={k}>{label}<input type="number" step="any" value={s.extra[k]} onChange={(e) => up('extra', k, e.target.value)} /></label>
              ))}
            </div>
            <p className="hint">Grand total: <b>{total}</b></p>
          </Card>

          <Card title="Payment Details">
            <label className="chk"><input type="checkbox" checked={s.payOn} onChange={(e) => top('payOn', e.target.checked)} /> Show payment details on invoice</label>
            {s.payOn && (
              <>
                <Fields list={PAY} obj={s.pay} onChange={(k, v) => up('pay', k, v)} />
                <label>Payment Instructions<textarea rows="2" value={s.pay.instr} onChange={(e) => up('pay', 'instr', e.target.value)} /></label>
              </>
            )}
          </Card>

          <Card title="Notes & Terms">
            <label>Notes<textarea rows="2" value={s.notes} onChange={(e) => top('notes', e.target.value)} /></label>
            <label>Terms &amp; Conditions<textarea rows="2" value={s.terms} onChange={(e) => top('terms', e.target.value)} /></label>
          </Card>
        </div>

        <aside className="pv"><h2 className="pvh">Live Preview</h2><Preview s={s} /></aside>
      </main>

      {mailOpen && (
        <div className="modal" onClick={() => setMailOpen(false)}>
          <div className="card" onClick={(e) => e.stopPropagation()}>
            <h2>Send by Email</h2>
            <label>To<input type="email" placeholder="customer@example.com" value={mail.to} onChange={(e) => setMail({ ...mail, to: e.target.value })} /></label>
            <label>Subject<input value={mail.subject} onChange={(e) => setMail({ ...mail, subject: e.target.value })} /></label>
            <label>Message<textarea rows="3" value={mail.message} onChange={(e) => setMail({ ...mail, message: e.target.value })} /></label>
            <p className="hint">{fname} will be attached.</p>
            <div className="row">
              <button className="btn primary" disabled={busy} onClick={send}>{busy ? 'Sending…' : 'Send'}</button>
              <button className="btn ghost" onClick={() => setMailOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.t}`}>{toast.m}</div>}
    </div>
  )
}
