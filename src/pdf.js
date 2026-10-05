import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { calc, fmt, num } from './calc'

const date = v => v ? new Date(v + 'T00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''
const addr = p => [p.address, [p.city,p.state,p.zip].filter(Boolean).join(', '), p.country].filter(Boolean)

export function buildPdf(s) {
  const doc = new jsPDF({ unit:'mm', format:'a4' })
  const c = calc(s), f = n => fmt(n, s.inv.currency, true), { biz, cust, inv, pay } = s
  const M=15, R=195
  let y=M
  const text=(t,x,yy,o={})=>{doc.setFont('helvetica',o.b?'bold':'normal');doc.setFontSize(o.size||9);doc.setTextColor(...(o.color||[40,40,40]));doc.text(String(t),x,yy,{align:o.align||'left'})}
  const lines=(arr,x,yy,step=4.2)=>{arr.filter(Boolean).forEach(v=>{text(v,x,yy);yy+=step});return yy}
  let leftY=M+3
  if(biz.logo){const ratio=biz.logo.w/biz.logo.h;const w=Math.min(45,25*ratio),h=w/ratio;doc.addImage(biz.logo.src,'PNG',M,leftY,w,h);leftY+=h+6}
  text(biz.name||'YOUR BUSINESS',M,leftY,{b:1,size:13});leftY+=6
  leftY=lines([...addr(biz),[biz.phone,biz.email,biz.website].filter(Boolean).join(' · '),biz.gstin&&`GSTIN: ${biz.gstin}`,biz.pan&&`PAN: ${biz.pan}`],M,leftY)
  text('INVOICE',R,M+8,{b:1,size:24,align:'right'})
  let ry=M+16
  ;[[`Invoice No.`,`#${inv.number}`],[`Invoice Date`,date(inv.date)],inv.due&&[`Due Date`,date(inv.due)],inv.po&&[`PO Number`,inv.po],inv.ref&&[`Reference`,inv.ref]].filter(Boolean).forEach(([a,b])=>{text(a,150,ry,{size:8,color:[110,110,110]});text(b,R,ry,{align:'right',size:8});ry+=4.8})
  y=Math.max(leftY,ry)+8;doc.setDrawColor(190,190,184);doc.line(M,y,R,y);y+=10
  text('BILLED TO',M,y,{b:1,size:8,color:[110,110,110]});y+=5;text(cust.name||'Customer Name',M,y,{b:1,size:10});y+=5;y=lines([cust.company,...addr(cust),[cust.email,cust.phone].filter(Boolean).join(' · '),cust.gstin&&`GSTIN: ${cust.gstin}`],M,y);y+=7
  autoTable(doc,{startY:y,margin:{left:M,right:M},theme:'plain',head:[['ITEM / DESCRIPTION','HSN/SAC','QTY','RATE','DISC.','TAX','AMOUNT']],body:c.rows.map(r=>[r.name+(r.desc?'\n'+r.desc:''),r.hsn||'—',r.qty,f(r.rate),`${num(r.discount)}%`,s.taxMode==='none'?'—':`${num(r.tax)}%`,f(r.amount)]),styles:{font:'helvetica',fontSize:8.5,cellPadding:2.7,textColor:[35,35,35],lineColor:[225,225,220],lineWidth:.15},headStyles:{fillColor:[245,245,242],textColor:[90,90,90],fontStyle:'bold',lineColor:[210,210,205],lineWidth:.2},columnStyles:{0:{halign:'left',cellWidth:72},1:{halign:'right',cellWidth:20},2:{halign:'right'},3:{halign:'right'},4:{halign:'right'},5:{halign:'right'},6:{halign:'right',cellWidth:27}}})
  y=doc.lastAutoTable.finalY+9
  if(s.payOn){text('PAYMENT DETAILS',M,y,{b:1,size:8,color:[110,110,110]});let py=y+5;py=lines([pay.bank&&`Bank: ${pay.bank}`,pay.accName&&`Account Name: ${pay.accName}`,pay.accNo&&`Account No.: ${pay.accNo}`,pay.ifsc&&`IFSC: ${pay.ifsc}`,pay.upi&&`UPI: ${pay.upi}`],M,py);if(pay.instr)py+=1; y=Math.max(y,py)}
  let ty=Math.max(y,doc.lastAutoTable.finalY+9)
  const totals=[['Subtotal',f(c.sub)],c.disc>0?['Discount',`- ${f(c.disc)}`]:null,...c.taxLines.map(l=>[l.label,f(l.amount)]),num(s.extra.shipping)?['Shipping',f(num(s.extra.shipping))]:null,num(s.extra.other)?['Other Charges',f(num(s.extra.other))]:null,num(s.extra.roundOff)!==0?['Round Off',f(num(s.extra.roundOff))]:null].filter(Boolean)
  let sy=doc.lastAutoTable.finalY+9
  totals.forEach(([a,b])=>{text(a,145,sy,{size:8,color:[90,90,90]});text(b,R,sy,{align:'right',size:8});sy+=4.8})
  doc.setDrawColor(180,180,175);doc.line(145,sy-1,R,sy-1);sy+=4;text('GRAND TOTAL',145,sy,{b:1,size:10});text(f(c.grand),R,sy,{b:1,size:10,align:'right'});y=Math.max(y,sy+8)
  if(s.notes){text('NOTES',M,y,{b:1,size:8,color:[110,110,110]});y+=5;lines(doc.splitTextToSize(s.notes,82),M,y);y+=10}
  if(s.terms){text('TERMS & CONDITIONS',105,y,{b:1,size:8,color:[110,110,110]});lines(doc.splitTextToSize(s.terms,85),105,y+5)}
  doc.setDrawColor(210,210,205);doc.line(M,280,R,280);text('T H A N K  Y O U',105,287,{b:1,size:9,align:'center'});text('FOR BEING A PART OF OUR JOURNEY',105,291,{size:6,align:'center',color:[130,130,130]})
  return doc
}
