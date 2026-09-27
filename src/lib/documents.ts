import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import ExcelJS from 'exceljs';
import { pool } from './db';
import { balanceAt, timelines, today } from './engine';
type Obj = Record<string, any>;
export async function makePdf(record:Obj,quotation=false) {
 const s=record.snapshot,c=s.company,customer=s.customer;
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
 let page=doc.addPage([595.28,841.89]),y=797;
 const clean=(v:unknown)=>String(v??'').replaceAll('₹','INR ').replace(/[\u2018\u2019]/g,"'").replace(/[\u2013\u2014]/g,'-').replaceAll('×','x').replace(/[^\x20-\x7e\xa0-\xff\n]/g,'');
 function line(value:unknown,size=9,strong=false,x=40) {
  if(y<48){page=doc.addPage([595.28,841.89]);y=795;}
  page.drawText(clean(value),{x,y,size,font:strong?bold:font,color:rgb(.13,.18,.23)});y-=size+7;
 }
 function wrap(value:unknown,size=9,strong=false) {
  for(const paragraph of clean(value).split('\n')) {
   let current='';
   for(const word of paragraph.split(' ')) { if(font.widthOfTextAtSize(current+' '+word,size)>510 && current){line(current,size,strong);current=word;}else current+=(current?' ':'')+word; }
   line(current,size,strong);
  }
 }
 if(c.logo) {try{const data=c.logo.split(',')[1],bytes=Buffer.from(data,'base64');const img=c.logo.startsWith('data:image/png')?await doc.embedPng(bytes):c.logo.startsWith('data:image/jpeg')?await doc.embedJpg(bytes):null;if(img){const scale=img.scaleToFit(70,40);page.drawImage(img,{x:485,y:785,width:scale.width,height:scale.height});y-=50;}}catch{}}
 wrap(c.name,16,true);wrap(c.unit1,8);wrap(c.unit2,8);wrap(`${c.mobile} | ${c.email}`,8);wrap(`${c.website}  |  GSTIN: ${c.gst_no||'Not set'}`,8);
 y-=12;line(quotation?'RENTAL QUOTATION':`${record.status==='DRAFT'?'DRAFT - ':''}INVOICE DETAILS`,14,true);
 line(quotation?`Quotation: ${record.id.slice(0,8)}  |  Date: ${s.date}`:`Invoice: ${record.invoice_no}  |  Date: ${String(record.generated_at instanceof Date?record.generated_at.toISOString():record.generated_at).slice(0,10)}`,10,true);
 line(`To: ${customer.name}`,11,true);wrap(customer.address);line(`GST: ${customer.gst_no||'—'}   State: ${customer.state_code}   Contact: ${customer.mobile}`);
 if(!quotation) line(`Billing period: ${s.period_start} to ${s.period_end}`);
 y-=10;
 const columns=quotation?[40,62,263,305,363,455,555]:[40,59,189,231,264,321,378,407,459,555];
 const headings=quotation?['Sr','Item','Qty','Rate/day','30-day rent','Material value']:['Sr','Item','HSN/SAC','Qty','From date','To date','Days','Rate/day','Amount'];
 function cell(value:unknown,x:number,top:number,width:number,strong=false,size=7.5) {
  const words=clean(value).split(/\s+/);let current='',offset=0;
  for(const word of words) {
   if(font.widthOfTextAtSize(current+' '+word,size)>width-7&&current){page.drawText(current,{x:x+3,y:top-offset,size,font:strong?bold:font});offset+=10;current=word;}else current+=(current?' ':'')+word;
  }
  if(current)page.drawText(current,{x:x+3,y:top-offset,size,font:strong?bold:font});
  return offset+10;
 }
 function tableHeader() {
  page.drawRectangle({x:40,y:y-6,width:515,height:22,color:rgb(.91,.95,.93)});
  headings.forEach((h,i)=>cell(h,columns[i],y,columns[i+1]-columns[i],true,7));y-=26;
 }
 tableHeader();
 const fmtDate=(v:string)=>v.split('-').reverse().join('/');
 let lastItem='',serial=0;
 for(const row of s.lines) {
  if(y<110){page=doc.addPage([595.28,841.89]);y=795;line(`${quotation?'Quotation':record.invoice_no} - continued`,9,true);tableHeader();}
  const first=row.item_id!==lastItem;if(first)serial++;lastItem=row.item_id;
  const values=quotation?[serial,row.name,row.quantity,Number(row.rate).toFixed(2),row.monthly_total,row.material_total]:[first?serial:'',first?row.name:row.formula,first?row.hsn:'',row.quantity,fmtDate(row.start),fmtDate(row.end),row.days,Number(row.rate).toFixed(2),row.amount];
  let height=20;
  values.forEach((v,i)=>{height=Math.max(height,cell(v,columns[i],y,columns[i+1]-columns[i],i===1&&first)+8);});
  if(!quotation&&first){cell(row.formula,columns[1],y-height+7,columns[2]-columns[1],false,7);height+=13;}
  page.drawLine({start:{x:40,y:y-height+5},end:{x:555,y:y-height+5},color:rgb(.87,.9,.88),thickness:.5});
  y-=height;
 }
 if(quotation) {line(`30-day rent estimate: INR ${s.monthly_total}`,11,true);line(`Material value: INR ${s.material_total}`,10);line(`Deposit: INR ${s.deposit}`,10);line(`Minimum rental commitment: ${customer.locking_days} days per dispatch batch.`,9);wrap(`PDC terms: ${s.pdc_terms||'Not specified'}`);}
 else {
  if(s.damages.length){y-=8;line('DAMAGE CHARGES',10,true);for(const d of s.damages) wrap(`${d.name}: ${d.quantity} damaged x INR ${d.price} original price = INR ${d.amount} (${d.date})`);}
  y-=12;line(`Rental subtotal: INR ${s.rental_total}`,10);line(`Damage charges: INR ${s.damage_total}`,10);line(`Subtotal: INR ${s.subtotal}`,10);line(`GST (${s.gst_percent}%): INR ${s.gst_amount}`,10);line(`TOTAL PAYABLE: INR ${s.grand_total}`,15,true);
  wrap(s.notes);
 }
 y-=12;wrap(`Bank: ${c.bank_name} | Account: ${c.bank_account} | IFSC: ${c.bank_ifsc}`,9,true);wrap(quotation?s.terms:c.terms,8);
 const pages=doc.getPages();pages.forEach((p,i)=>p.drawText(`Jyoti Rental Desk  |  ${i+1} / ${pages.length}`,{x:40,y:25,size:8,font}));
 return doc.save();
}
export async function makeExcel(kind:string,customerId?:string) {
 const book=new ExcelJS.Workbook(),sheet=book.addWorksheet(kind==='ledger'?'Customer ledger':'Invoices');
 if(kind==='ledger') {
  sheet.columns=[{header:'Customer',key:'customer',width:28},{header:'Item',key:'item',width:34},{header:'Date',key:'date',width:14},{header:'Movement',key:'type',width:14},{header:'Quantity',key:'quantity',width:12},{header:'Physical balance',key:'physical',width:19},{header:'Billable balance',key:'billable',width:19},{header:'Damaged qty',key:'damaged_quantity',width:16},{header:'Original price',key:'damage_price',width:16},{header:'Note',key:'note',width:32}];
  const ms=(await pool.query(`SELECT m.*,c.name AS customer,i.name AS item FROM movements m JOIN customers c ON c.id=m.customer_id JOIN items i ON i.id=m.item_id ${customerId?'WHERE customer_id=$1':''} ORDER BY date,created_at,id`,customerId?[customerId]:[])).rows;
  for(const m of ms){const history=ms.filter(x=>x.customer_id===m.customer_id&&x.item_id===m.item_id).map(x=>({...x,created_at:x.created_at.toISOString()}));const t=timelines(history);sheet.addRow({...m,physical:balanceAt(t.physical,m.date),billable:balanceAt(t.billable,m.date)});}
 } else if(kind==='invoices') {
  sheet.columns=[{header:'Invoice',key:'invoice_no',width:24},{header:'Customer',key:'name',width:28},{header:'From',key:'period_start',width:14},{header:'To',key:'period_end',width:14},{header:'Status',key:'status',width:12},{header:'Rental',key:'rental_total',width:18},{header:'Damage',key:'damage_total',width:18},{header:'GST',key:'gst_amount',width:18},{header:'Total',key:'grand_total',width:20}];
  const rows=(await pool.query('SELECT i.*,c.name FROM invoices i JOIN customers c ON c.id=i.customer_id ORDER BY generated_at DESC')).rows;
  rows.forEach(r=>sheet.addRow(r));
 }else throw new Error('Unknown export.');
 sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF173B36'}};sheet.views=[{state:'frozen',ySplit:1}];sheet.autoFilter={from:{row:1,column:1},to:{row:1,column:sheet.columnCount}};
 book.creator='Jyoti Rental Desk';book.created=new Date(today());
 return book.xlsx.writeBuffer();
}
