import { useEffect, useMemo, useState } from 'react'
import Preview from './Preview'
import { CURRENCIES, calc, fmt, validate } from './calc'
import { buildPdf } from './pdf'

const iso = (add = 0) => { const d = new Date(); d.setDate(d.getDate() + add); return d.toISOString().slice(0, 10) }
const id = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
const newItem = (tax = 18) => ({ id: id(), name: '', desc: '', hsn: '', qty: 1, rate: 0, discount: 0, tax })
const initial = () => ({
  template: 'minimal',
  biz: { name: '', logo: null, email: '', phone: '', website: '', address: '', city: '', state: '', country: 'India', zip: '', gstin: '', pan: '' },
  cust: { name: '', company: '', email: '', phone: '', address: '', city: '', state: '', country: 'India', zip: '', gstin: '' },
  inv: { number: 'INV-001', date: iso(), due: iso(15), po: '', ref: '', currency: 'INR' },
  items: [newItem(18)],
  taxMode: 'gst', gstType: 'split', customLabel: 'Tax',
  extra: { shipping: 0, other: 0, discount: 0, roundOff: 0 },
  payOn: true, pay: { bank: '', accName: '', accNo: '', ifsc: '', upi: '', instr: '' },
  notes: 'Thank you for your business.', terms: 'Payment is due within 15 days.'
})

const BIZ = [['name', 'Business / Company Name'], ['email', 'Email', 'email'], ['phone', 'Phone'], ['website', 'Website'], ['address', 'Address'], ['city', 'City'], ['state', 'State'], ['country', 'Country'], ['zip', 'ZIP / PIN'], ['gstin', 'GSTIN'], ['pan', 'PAN']]
const CUST = [['name', 'Customer Name'], ['company', 'Company Name'], ['email', 'Email', 'email'], ['phone', 'Phone'], ['address', 'Address'], ['city', 'City'], ['state', 'State'], ['country', 'Country'], ['zip', 'ZIP / PIN'], ['gstin', 'GSTIN']]
const INV = [['number', 'Invoice Number'], ['date', 'Invoice Date', 'date'], ['due', 'Due Date', 'date'], ['po', 'PO Number'], ['ref', 'Reference Number']]
const PAY = [['bank', 'Bank Name'], ['accName', 'Account Name'], ['accNo', 'Account Number'], ['ifsc', 'IFSC'], ['upi', 'UPI ID']]
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function Card({ title, children, action }) { return <section className="card"><div className="card-head"><h2>{title}</h2>{action}</div>{children}</section> }
function Fields({ list, obj, onChange }) { return <div className="grid">{list.map(([k, label, type = 'text']) => <label key={k}>{label}<input type={type} value={obj[k] || ''} onChange={e => onChange(k, e.target.value)} /></label>)}</div> }

export default function App() {
  const [s, setS] = useState(() => { try { return JSON.parse(localStorage.getItem('invoice-draft')) || initial() } catch { return initial() } })
  const [saved, setSaved] = useState(() => { try { return JSON.parse(localStorage.getItem('invoice-saved')) || [] } catch { return [] } })
  const [errors, setErrors] = useState([])
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)
  const [savedOpen, setSavedOpen] = useState(false)
  const [mailOpen, setMailOpen] = useState(false)
  const [mail, setMail] = useState({ to: '', subject: '', message: 'Please find your invoice attached.' })
  const totals = useMemo(() => calc(s), [s])
  const fname = `Invoice-${s.inv.number.replace(/[\\/:*?"<>|\s]+/g, '-')}.pdf`

  useEffect(() => localStorage.setItem('invoice-draft', JSON.stringify(s)), [s])
  useEffect(() => localStorage.setItem('invoice-saved', JSON.stringify(saved)), [saved])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2800); return () => clearTimeout(t) }, [toast])

  const show = (m, t = 'ok') => setToast({ m, t })
  const up = (g, k, v) => setS(p => ({ ...p, [g]: { ...p[g], [k]: v } }))
  const top = (k, v) => setS(p => ({ ...p, [k]: v }))
  const setItem = (itemId, k, v) => setS(p => ({ ...p, items: p.items.map(i => i.id === itemId ? { ...i, [k]: v } : i) }))
  const addItem = () => setS(p => ({ ...p, items: [...p.items, newItem(p.items[0]?.tax || 18)] }))
  const removeItem = itemId => setS(p => ({ ...p, items: p.items.length === 1 ? [newItem(18)] : p.items.filter(i => i.id !== itemId) }))

  const onLogo = file => {
    if (!file) return
    if (!file.type.startsWith('image/')) return show('Please select an image file.', 'error')
    if (file.size > 3 * 1024 * 1024) return show('Logo must be smaller than 3 MB.', 'error')
    const reader = new FileReader()
    reader.onload = () => { const img = new Image(); img.onload = () => { const k = Math.min(1, 500 / img.width, 250 / img.height); const cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); up('biz', 'logo', { src: cv.toDataURL('image/png'), w: cv.width, h: cv.height }) }; img.src = reader.result }
    reader.readAsDataURL(file)
  }

  const guard = () => { const e = validate(s); setErrors(e); if (e.length) show(e[0], 'error'); return !e.length }
  const run = async fn => { setBusy(true); try { await fn() } catch (e) { show(e.message || 'Something went wrong.', 'error') } finally { setBusy(false) } }
  const save = () => { if (!guard()) return; const record = { ...structuredClone(s), savedAt: Date.now() }; setSaved(p => [record, ...p.filter(x => x.id !== s.id)]); show('Invoice saved locally.') }
  const nextNumber = current => { const m = String(current || '').match(/^(.*?)(\d+)$/); return m ? `${m[1]}${String(Number(m[2]) + 1).padStart(m[2].length, '0')}` : 'INV-002' }
  const createSimilar = () => { const n = structuredClone(s); n.id = id(); n.inv.number = nextNumber(s.inv.number); n.inv.date = iso(); n.inv.due = iso(15); n.cust = initial().cust; n.items = s.items.map(i => ({ ...i, id: id() })); setS(n); setErrors([]); setSavedOpen(false); show('Similar invoice created — branding and payment details were kept.') }
  const load = record => { setS(structuredClone(record)); setSavedOpen(false); setErrors([]); show('Invoice loaded.') }
  const deleteSaved = recordId => setSaved(p => p.filter(x => x.id !== recordId))
  const reset = () => { if (!window.confirm('Are you sure you want to clear this invoice?')) return; setS(initial()); setErrors([]); show('Invoice cleared.') }
  const download = () => { if (!guard()) return; run(async () => { buildPdf(s).save(fname); show('PDF downloaded.') }) }
  const print = () => { if (guard()) window.print() }
  const openMail = () => { if (!guard()) return; setMail({ to: s.cust.email || '', subject: `Invoice ${s.inv.number}`, message: 'Please find your invoice attached.' }); setMailOpen(true) }
  const send = () => run(async () => { if (!EMAIL_RE.test(mail.to)) throw new Error('Enter a valid recipient email.'); const pdf = buildPdf(s).output('datauristring').split(',')[1]; const r = await fetch('/api/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...mail, filename: fname, pdf }) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Email failed. Start the email server and try again.'); setMailOpen(false); show('Email sent.') })

  return <div className="app">
    <header className="top no-print">
      <div><div className="eyebrow">SIMPLE INVOICING</div><h1>Invoice Maker</h1><p>Create polished, branded invoices without an account.</p></div>
      <div className="seg">{['classic', 'modern', 'minimal'].map(t => <button key={t} className={s.template === t ? 'on' : ''} onClick={() => top('template', t)}>{t[0].toUpperCase() + t.slice(1)}</button>)}</div>
    </header>

    <div className="actions no-print">
      <button className="btn primary" onClick={() => { if (guard()) document.getElementById('invoice')?.scrollIntoView({ behavior: 'smooth' }) }}>Generate Invoice</button>
      <button className="btn" disabled={busy} onClick={download}>{busy ? 'Generating…' : 'Download PDF'}</button>
      <button className="btn" onClick={print}>Print</button>
      <button className="btn" onClick={openMail}>Send by Email</button>
      <span className="sp" />
      <button className="btn ghost" onClick={save}>Save Invoice</button>
      <button className="btn ghost" onClick={() => setSavedOpen(true)}>Saved / Similar</button>
      <button className="btn danger" onClick={reset}>Clear</button>
    </div>

    {errors.length > 0 && <div className="errs no-print"><b>Please fix:</b><ul>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul></div>}

    <main className="layout">
      <div className="form no-print">
        <Card title="Your Business">
          <div className="logo-row">
            {s.biz.logo ? <img src={s.biz.logo.src} alt="Business logo" /> : <div className="ph">Logo</div>}
            <label className="btn small"><span>Upload logo</span><input hidden type="file" accept="image/*" onChange={e => { onLogo(e.target.files[0]); e.target.value = '' }} /></label>
            {s.biz.logo && <button className="btn small danger" onClick={() => up('biz', 'logo', null)}>Remove</button>}
          </div>
          <Fields list={BIZ} obj={s.biz} onChange={(k, v) => up('biz', k, v)} />
        </Card>

        <Card title="Bill To"><Fields list={CUST} obj={s.cust} onChange={(k, v) => up('cust', k, v)} /></Card>

        <Card title="Invoice Details">
          <div className="grid">{INV.map(([k, label, type = 'text']) => <label key={k}>{label}<input type={type} value={s.inv[k]} onChange={e => up('inv', k, e.target.value)} /></label>)}<label>Currency<select value={s.inv.currency} onChange={e => up('inv', 'currency', e.target.value)}>{Object.entries(CURRENCIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label></div>
        </Card>

        <Card title="Items" action={<button className="text-btn" onClick={addItem}>+ Add Item</button>}>
          <div className="tw"><table className="items"><thead><tr><th>Item</th><th>Description</th><th>Qty</th><th>Rate</th><th>Disc %</th><th>Tax %</th><th>Amount</th><th /></tr></thead><tbody>{totals.rows.map(r => <tr key={r.id}>
            <td className="wide" data-label="Item"><input value={r.name} placeholder="Item name" onChange={e => setItem(r.id, 'name', e.target.value)} /></td>
            <td className="wide" data-label="Description"><input value={r.desc} placeholder="Description" onChange={e => setItem(r.id, 'desc', e.target.value)} /></td>
            <td data-label="HSN/SAC"><input className="n" value={r.hsn || ''} placeholder="HSN" onChange={e => setItem(r.id, 'hsn', e.target.value)} /></td>
            <td data-label="Qty"><input className="n" type="number" min="0" step="any" value={r.qty} onChange={e => setItem(r.id, 'qty', e.target.value)} /></td>
            <td data-label="Rate"><input className="n" type="number" min="0" step="any" value={r.rate} onChange={e => setItem(r.id, 'rate', e.target.value)} /></td>
            <td data-label="Disc %"><input className="n" type="number" min="0" step="any" value={r.discount} onChange={e => setItem(r.id, 'discount', e.target.value)} /></td>
            <td data-label="Tax %"><input className="n" type="number" min="0" step="any" value={r.tax} onChange={e => setItem(r.id, 'tax', e.target.value)} /></td>
            <td className="amt" data-label="Amount">{fmt(r.amount, s.inv.currency)}</td>
            <td><button className="x" onClick={() => removeItem(r.id)}>×</button></td>
          </tr>)}</tbody></table></div>
          <div className="tax-row"><label>Tax mode<select value={s.taxMode} onChange={e => top('taxMode', e.target.value)}><option value="none">No Tax</option><option value="gst">GST</option><option value="custom">Custom Tax</option></select></label>{s.taxMode === 'gst' && <label>GST type<select value={s.gstType} onChange={e => top('gstType', e.target.value)}><option value="split">CGST + SGST</option><option value="igst">IGST</option></select></label>}</div>
        </Card>

        <Card title="Additional Charges"><div className="grid">{[['shipping','Shipping'],['other','Other Charges'],['discount','Discount (flat)'],['roundOff','Round Off (+/-)']].map(([k,l]) => <label key={k}>{l}<input type="number" step="any" value={s.extra[k]} onChange={e => setS(p => ({ ...p, extra: { ...p.extra, [k]: e.target.value } }))} /></label>)}</div></Card>

        <Card title="Payment Details" action={<label className="switch"><input type="checkbox" checked={s.payOn} onChange={e => top('payOn', e.target.checked)} /><span>Show on invoice</span></label>}>
          {s.payOn && <><Fields list={PAY} obj={s.pay} onChange={(k, v) => up('pay', k, v)} /><label>Payment Instructions<textarea rows="3" value={s.pay.instr} onChange={e => up('pay','instr',e.target.value)} placeholder="Payment instructions" /></label></>}
        </Card>

        <Card title="Notes & Terms"><label>Notes<textarea rows="3" value={s.notes} onChange={e => top('notes', e.target.value)} /></label><label>Terms & Conditions<textarea rows="4" value={s.terms} onChange={e => top('terms', e.target.value)} /></label></Card>
      </div>

      <section className="pv"><div className="pvh no-print">Live preview · A4 invoice</div><div className="fit"><Preview s={s} /></div></section>
    </main>

    {savedOpen && <div className="modal no-print" onMouseDown={e => e.target === e.currentTarget && setSavedOpen(false)}><div className="modal-card"><div className="modal-head"><div><div className="eyebrow">LOCAL ONLY</div><h2>Saved invoices</h2></div><button className="icon-btn" onClick={() => setSavedOpen(false)}>×</button></div><div className="similar"><button className="similar-card new" onClick={createSimilar}><b>+ Create similar invoice</b><span>Keeps your business, logo, payment details, template and items. Clears the customer.</span></button>{saved.length === 0 && <div className="empty">No saved invoices yet. Save an invoice to reuse it later.</div>}{saved.map(r => <div className="saved-row" key={r.id}><button onClick={() => load(r)}><b>{r.inv.number}</b><span>{r.cust.name || 'No customer'} · {fmt(calc(r).grand, r.inv.currency)}</span></button><button className="delete-link" onClick={() => deleteSaved(r.id)}>Delete</button></div>)}</div></div></div>}

    {mailOpen && <div className="modal no-print"><div className="modal-card small-modal"><div className="modal-head"><div><div className="eyebrow">EMAIL INVOICE</div><h2>Send PDF</h2></div><button className="icon-btn" onClick={() => setMailOpen(false)}>×</button></div><label>Recipient email<input type="email" value={mail.to} onChange={e => setMail({ ...mail, to: e.target.value })} placeholder="customer@example.com" /></label><label>Subject<input value={mail.subject} onChange={e => setMail({ ...mail, subject: e.target.value })} /></label><label>Message<textarea rows="5" value={mail.message} onChange={e => setMail({ ...mail, message: e.target.value })} /></label><div className="modal-actions"><button className="btn" onClick={() => setMailOpen(false)}>Cancel</button><button className="btn primary" onClick={send}>Send PDF</button></div><p className="hint">Email sending uses the included optional SMTP server. The invoice PDF is generated locally first.</p></div></div>}
    {toast && <div className={`toast ${toast.t === 'error' ? 'error' : ''}`}>{toast.m}</div>}
  </div>
}
