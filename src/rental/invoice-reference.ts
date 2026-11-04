import {readFile} from 'node:fs/promises';
import {PDFDocument,StandardFonts,rgb,type PDFPage,type PDFImage} from 'pdf-lib';
import ExcelJS from 'exceljs';
import Decimal from 'decimal.js';
import {amountWords} from './print-documents';
import {paymentSummary} from './payments';
type Row=Record<string,any>;
const money=(n:unknown)=>new Decimal(String(n||0)).toFixed(2);
const clean=(s:unknown)=>String(s??'').replaceAll('₹','INR ').replaceAll('×','x').replace(/[–—]/g,'-').replace(/[^\x20-\x7e\n]/g,'');
const date=(s:unknown)=>{const [y,m,d]=String(s||'').slice(0,10).split('-');return d?`${d}/${m}/${y.slice(-2)}`:'';};
export function invoiceRows(s:Row):any[][]{return [...s.lines.map((r:Row)=>[[r.name,r.formula].filter(Boolean).join('\n'),r.hsn||'',r.start,r.end,r.days,r.quantity,r.rate,s.gst_percent,r.amount]),...(s.damages||[]).map((r:Row)=>[r.name+' (damage)',r.hsn||'',r.date,r.date,1,r.quantity,r.price,s.gst_percent,r.amount])];}
export async function referenceInvoicePdf(record:Row){
 const s=record.snapshot,c=s.company,b=s.customer,d=s.document_details||{},payments=record.payments||[],summary=paymentSummary(s.grand_total,payments);
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
 let logo:PDFImage|undefined;try{logo=c.logo?.startsWith('data:image/jpeg;')?await doc.embedJpg(Buffer.from(c.logo.split(',')[1],'base64')):await doc.embedPng(c.logo?.startsWith('data:image/png;')?Buffer.from(c.logo.split(',')[1],'base64'):await readFile('public/branding/jyoti-logo.png'));}catch{}
 let page:PDFPage,y=0;const left=24,right=571,width=547;
 function wrap(value:unknown,w:number,size=8,strong=false){const f=strong?bold:font,out:string[]=[];for(const para of clean(value).split('\n')){let line='';for(const char of para){if(f.widthOfTextAtSize(line+char,size)>w&&line){out.push(line);line='';}line+=char;}out.push(line);}return out;}
 function text(value:unknown,x:number,top:number,w:number,size=8,strong=false){const lines=wrap(value,w,size,strong);lines.forEach((line,i)=>page.drawText(line,{x,y:top-size-i*(size+3),size,font:strong?bold:font}));return lines.length*(size+3);}
 function centered(value:unknown,x:number,top:number,w:number,size=8,strong=false){const f=strong?bold:font;wrap(value,w,size,strong).forEach((line,i)=>page.drawText(line,{x:x+(w-f.widthOfTextAtSize(line,size))/2,y:top-size-i*(size+3),size,font:f}));}
 function box(x:number,top:number,w:number,h:number){page.drawRectangle({x,y:top-h,width:w,height:h,borderWidth:.6,borderColor:rgb(0,0,0)});}
 function row(values:unknown[],widths:number[],strong=false,paginate=false){const cells=values.map((v,i)=>wrap(v,widths[i]-8,8,strong));const count=Math.max(...cells.map(c=>c.length));let offset=0;while(offset<count){if(paginate&&y<57)nextItemPage();const take=paginate?Math.max(1,Math.min(count-offset,Math.floor((y-35-8)/11))):count;const h=Math.max(22,take*11+8);let x=left;cells.forEach((v,i)=>{if(paginate){for(const edge of [x,x+widths[i]])page.drawLine({start:{x:edge,y},end:{x:edge,y:y-h},thickness:.6});}else box(x,y,widths[i],h);if(paginate){v.slice(offset,offset+take).forEach((line,j)=>{const isItemName=i===0&&offset+j===0&&clean(values[0]).includes('\n');const tx=isItemName?x+4:x+widths[i]-4-(strong?bold:font).widthOfTextAtSize(line,8);page.drawText(line,{x:tx,y:y-12-j*11,size:8,font:strong?bold:font});});}else text(v.slice(offset,offset+take).join('\n'),x+4,y-4,widths[i]-8,8,strong);x+=widths[i];});y-=h;offset+=take;}}
 const widths=[239,35,50,50,25,45,30,73];
 function next(){page=doc.addPage([595.28,841.89]);
  const name=clean(c.name||'JYOTI ENGINEERING');
  const details=[c.business_description||'Scaffolding Material On Hire Bases',c.unit1,c.unit2,
   [c.mobile?'Phone / Mobile: '+c.mobile:'',c.gst_no?'State Code: '+String(c.gst_no).slice(0,2):''].filter(Boolean).join('    '),
   c.email?'Email: '+c.email:'',c.website?'Web: '+c.website:''].filter(Boolean).join('\n');
  const headerHeight=Math.max(96,38+wrap(details,449,8).length*11);
  if(logo){const size=logo.scaleToFit(90,96);page.drawImage(logo,{x:left,y:810-size.height,width:size.width,height:size.height});}
  box(120,810,451,headerHeight);page.drawRectangle({x:121,y:778,width:449,height:31,color:rgb(.83,.83,.83)});
  let size=22;while(bold.widthOfTextAtSize(name,size)>439&&size>9)size--;centered(name,126,806,439,size,true);
  centered(details,121,775,449,8);
  const titleTop=810-headerHeight-5;
  centered((record.status==='DRAFT'?'DRAFT - ':'')+'TAX INVOICE',left,titleTop,width,14,true);
  const buyerTop=titleTop-24;
  const buyer='M/s. '+b.name+'\n'+(b.address||'')+'\nGST No.: '+(b.gst_no||'-')+'    State Code: '+(b.state_code||'-');
  const bh=Math.max(61,wrap(buyer,377).length*11+10);box(left,buyerTop,385,bh);text(buyer,left+5,buyerTop-5,375);box(409,buyerTop,162,bh);text('Invoice No.: '+record.invoice_no+'\n\nInvoice Date: '+date(record.generated_at instanceof Date?record.generated_at.toISOString():record.generated_at),414,buyerTop-5,152);
  y=buyerTop-bh;const site='Site Name: '+(d.ship_to||d.destination||b.address||'-');const sh=Math.max(30,wrap(site,width-10).length*11+8);box(left,y,width,sh);text(site,left+5,y-4,width-10);y-=sh;
  row(['Item Name','HSN/\nSAC\nCode','From Date','To Date','Day','Hire\nPer Day\nPer Pcs','GST\n%','Amount'],widths);
 }
 next();
 const tableTop=y;
 function closeTable(){
  page.drawLine({start:{x:left,y},end:{x:right,y},thickness:.6});
 }
 function nextItemPage(){closeTable();next();}
 const entries:Row[]=[...s.lines,...(s.damages||[]).map((v:Row)=>({...v,name:v.name+' (damage)',start:v.date,end:v.date,days:1,rate:v.price}))];
 function itemCells(r:Row,label:string){
  const prefix=label?'\n':'',rate=new Decimal(r.rate);
  return [label+prefix+(r.formula||String(r.quantity)),prefix+(r.hsn||''),prefix+date(r.start),prefix+date(r.end),prefix+r.days,prefix+rate.toFixed(Math.max(2,rate.decimalPlaces())),prefix+s.gst_percent,prefix+money(r.amount)];
 }
 function itemHeight(cells:string[]){
  return Math.max(22,...cells.map((v,i)=>wrap(v,widths[i]-8).length*11+8));
 }
 for(let start=0;start<entries.length;){
  const first=entries[start];
  let end=start+1;
  while(end<entries.length&&entries[end].name===first.name&&entries[end].item_id===first.item_id)end++;
  const group=entries.slice(start,end).map((r,i)=>itemCells(r,i===0?r.name:''));
  const height=group.reduce((sum,cells)=>sum+itemHeight(cells),0);
  if(height<=tableTop-35&&height>y-35)nextItemPage();
  for(let i=0;i<group.length;i++){
   let cells=group[i];
   if(itemHeight(cells)>y-35&&y<tableTop){
    nextItemPage();
    if(i>0)cells=itemCells(entries[start+i],first.name+' (continued)');
   }
   row(cells,widths,false,true);
  }
  start=end;
 }
 closeTable();
 // Totals derive exclusively from the invoice snapshot; payments derive from posted receipts.
 const totals:unknown[][]=[['Rental subtotal',money(s.rental_total)]];if(Number(s.damage_total))totals.push(['Damage charges',money(s.damage_total)]);totals.push(['Taxable subtotal',money(s.subtotal)]);
 if(d.tax_mode==='CGST_SGST'){const half=new Decimal(s.gst_amount).div(2).toDecimalPlaces(2);totals.push(['SGST '+new Decimal(s.gst_percent).div(2)+'%',half.toFixed(2)],['CGST '+new Decimal(s.gst_percent).div(2)+'%',new Decimal(s.gst_amount).sub(half).toFixed(2)]);}else totals.push([(d.tax_mode==='IGST'?'IGST':'GST')+' '+s.gst_percent+'%',money(s.gst_amount)]);
 totals.push(['Grand Total',money(s.grand_total)],['Payment Received',summary.paid],['Outstanding',summary.outstanding]);
 const receipt=payments.map((p:Row)=>`${date(p.date)} ${p.voucher_no}: INR ${money(p.total)}`).join('\n')||'No receipts allocated';
 const registration='GST No.: '+(c.gst_no||'-')+'    PAN No.: '+(c.pan_no||(c.gst_no?String(c.gst_no).slice(2,12):'-'))+'\nUdyam No.: '+(c.udyam_no||'-');
 const notes=[registration,'Receipt Detail: '+receipt,'Payment status: '+summary.payment_status,'Note: '+(s.notes||''),'Amount in words: '+amountWords(s.grand_total)].join('\n');
 const noteLines=wrap(notes,332),noteLimit=16,h=Math.max(totals.length*22,Math.min(noteLimit,noteLines.length)*11+10,noteLines.length<=noteLimit?39+Math.max(44,wrap(receipt,332).length*11+25)+Math.max(30,wrap(s.notes||'',332).length*11+12)+Math.max(32,wrap(amountWords(s.grand_total),332).length*11+10):0);
 if(y-h<110)next();
 if(noteLines.length<=noteLimit){let ny=y;const sections=[[registration,39],['Receipt Detail\n'+receipt+'\n'+summary.payment_status,Math.max(44,wrap(receipt,332).length*11+25)],['Note: '+(s.notes||''),Math.max(30,wrap(s.notes||'',332).length*11+12)]] as const;let used=0;for(const [value,height] of sections){box(left,ny,342,height);text(value,left+5,ny-5,332);ny-=height;used+=height;}const remaining=Math.max(32,h-used);box(left,ny,342,remaining);text('Rs.: '+amountWords(s.grand_total),left+5,ny-5,332);}
 else{box(left,y,342,h);text(noteLines.slice(0,noteLimit).join('\n'),left+5,y-5,332);}
 let ty=y;totals.forEach(([label,value])=>{box(366,ty,135,22);box(501,ty,70,22);text(label,370,ty-5,127,8,true);const valueText=String(value);text(valueText,566-bold.widthOfTextAtSize(valueText,8),ty-5,68,8,true);ty-=22;});y-=h;
 const bank=['Bank: '+(c.bank_name||'-'),'A/c: '+(c.bank_account||'-'),'IFSC: '+(c.bank_ifsc||'-')].join('\n');if(y<100)next();box(left,y,342,65);text(bank,left+5,y-5,332);box(366,y,205,65);text('For '+c.name,371,y-5,195,9,true);text('Authorised Signatory',415,y-46,150);
 // Long terms and extra dispatch fields continue cleanly instead of clipping the footer.
 const extra=[noteLines.length>noteLimit?'Receipt / notes continued:\n'+noteLines.slice(noteLimit).join('\n'):'',c.terms,...Object.entries(d).filter(([k,v])=>v&&!['tax_mode','ship_to','destination'].includes(k)).map(([k,v])=>k.replaceAll('_',' ')+': '+v)].filter(Boolean).join('\n');
 if(extra){y-=73;for(const line of wrap(extra,width,7)){if(y<35){next();y-=8;}text(line,left,y,width,7);y-=10;}}
 const pages=doc.getPages();
 pages.forEach((p,i)=>{
  const count='Page '+(i+1)+' of '+pages.length;
  const shade=rgb(.3,.3,.3);
  p.drawLine({start:{x:left,y:28},end:{x:right,y:28},thickness:.45,color:rgb(.7,.7,.7)});
  p.drawText(String(record.invoice_no),{x:left,y:15,size:7,font,color:shade});
  const credit='Powered by SnapAi';
  p.drawText(credit,{x:left+(width-font.widthOfTextAtSize(credit,7))/2,y:15,size:7,font,color:shade});
  p.drawText(count,{x:right-font.widthOfTextAtSize(count,7),y:15,size:7,font,color:shade});
 });
 return doc.save();
}
export async function invoiceExcel(record:Row){
 const s=record.snapshot,c=s.company,b=s.customer,book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Invoice');
 sheet.columns=[32,15,15,15,10,12,16,12,18].map(width=>({width}));
 const line=(value:string)=>{const r=sheet.addRow([value]);sheet.mergeCells(r.number,1,r.number,9);r.alignment={wrapText:true,vertical:'middle'};r.height=Math.max(23,Math.ceil(value.length/110)*16);return r;};
 line(c.name).font={bold:true,size:18};line([c.unit1,c.unit2,c.mobile,c.email].filter(Boolean).join(' | '));line('TAX INVOICE '+record.invoice_no+' | '+record.status+' | '+date(record.generated_at instanceof Date?record.generated_at.toISOString():record.generated_at));
 line('Customer: '+b.name);line('Address: '+(b.address||''));line('Customer GST: '+(b.gst_no||'-')+' | State: '+(b.state_code||'-'));line('Company GST: '+(c.gst_no||'-'));line('Billing period: '+s.period_start+' to '+s.period_end);
 const header=sheet.addRow(['Item Name','HSN/SAC','From Date','To Date','Days','Quantity','Hire/day/pc','GST %','Amount']);header.font={bold:true};header.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFD9D9D9'}};
 invoiceRows(s).forEach(r=>sheet.addRow(r.map((v,i)=>i>=4?Number(v):String(v))));
 sheet.getColumn(7).numFmt='0.0000';sheet.getColumn(9).numFmt='0.00';
 for(const [label,key] of [['Rental subtotal','rental_total'],['Damage charges','damage_total'],['Taxable subtotal','subtotal']])sheet.addRow([label,'','','','','','','',Number(s[key])]);
 if(s.document_details?.tax_mode==='CGST_SGST'){const half=new Decimal(s.gst_amount).div(2).toDecimalPlaces(2);sheet.addRow(['CGST '+new Decimal(s.gst_percent).div(2)+'%','','','','','','','',half.toNumber()]);sheet.addRow(['SGST '+new Decimal(s.gst_percent).div(2)+'%','','','','','','','',new Decimal(s.gst_amount).sub(half).toNumber()]);}else sheet.addRow([(s.document_details?.tax_mode==='IGST'?'IGST':'GST')+' '+s.gst_percent+'%','','','','','','','',Number(s.gst_amount)]);
 sheet.addRow(['Grand total','','','','','','','',Number(s.grand_total)]);
 const summary=paymentSummary(s.grand_total,record.payments||[]);sheet.addRow(['Payment received','','','','','','','',Number(summary.paid)]);sheet.addRow(['Outstanding','','','','','','','',Number(summary.outstanding)]);line('Payment status: '+summary.payment_status);line(amountWords(s.grand_total));line('Notes: '+(s.notes||''));
 for(const [k,v] of Object.entries(s.document_details||{}))if(v)line(k.replaceAll('_',' ')+': '+v);
 line('Bank: '+(c.bank_name||'')+' | Account: '+(c.bank_account||'')+' | IFSC: '+(c.bank_ifsc||''));line('Terms: '+(c.terms||''));
 const receipts=book.addWorksheet('Payment history');receipts.columns=[{header:'Date',key:'date',width:18},{header:'Voucher reference',key:'voucher_no',width:30},{header:'Amount allocated',key:'total',width:22}];for(const p of record.payments||[])receipts.addRow({...p,total:Number(p.total)});receipts.getColumn(3).numFmt='0.00';
 sheet.eachRow(r=>r.eachCell(cell=>{cell.alignment={...cell.alignment,vertical:'top',wrapText:true};cell.border={bottom:{style:'hair',color:{argb:'FFCCCCCC'}}};}));sheet.pageSetup={paperSize:9,orientation:'portrait',fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:`1:${header.number}`};book.creator='Jyoti ERP';return new Uint8Array(await book.xlsx.writeBuffer());
}
