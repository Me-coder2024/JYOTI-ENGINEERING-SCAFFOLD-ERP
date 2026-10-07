import {PDFDocument,StandardFonts,rgb,type PDFImage,type PDFPage} from 'pdf-lib';
import Decimal from 'decimal.js';
type Row=Record<string,any>;
const clean=(v:unknown)=>String(v??'').replaceAll('₹','INR ').replace(/[\u2018\u2019]/g,"'").replace(/[\u2013\u2014]/g,'-').replaceAll('×','x').replace(/[^\x20-\x7e\n]/g,'');
const cash=(v:unknown)=>new Decimal(String(v||0)).toFixed(2);
export function amountWords(value:string):string{
 const small=['Zero','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'],tens=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
 const words=(n:number):string=>n<20?small[n]:n<100?tens[Math.floor(n/10)]+(n%10?' '+small[n%10]:''):n<1000?words(Math.floor(n/100))+' Hundred'+(n%100?' '+words(n%100):''):n<100000?words(Math.floor(n/1000))+' Thousand'+(n%1000?' '+words(n%1000):''):n<10000000?words(Math.floor(n/100000))+' Lakh'+(n%100000?' '+words(n%100000):''):words(Math.floor(n/10000000))+' Crore'+(n%10000000?' '+words(n%10000000):'');
 const [r,p]=cash(value).split('.');return 'INR '+words(Number(r))+(Number(p)?' and '+words(Number(p))+' Paise':'')+' Only';
}
async function layout(company:Row,title:string){
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);let page:PDFPage,y=0;
 let logo:PDFImage|undefined;try{if(company.logo?.startsWith('data:image/png;base64,'))logo=await doc.embedPng(Buffer.from(company.logo.split(',')[1],'base64'));else if(company.logo?.startsWith('data:image/jpeg;base64,'))logo=await doc.embedJpg(Buffer.from(company.logo.split(',')[1],'base64'));}catch{}
 const blue=rgb(.05,.28,.48),gold=rgb(.83,.63,.04),black=rgb(.08,.08,.08);
 function wrap(value:unknown,width:number,size=8,strong=false){const f=strong?bold:font,lines:string[]=[];for(const paragraph of clean(value).split('\n')){let current='';for(const word of paragraph.split(/\s+/)){for(const char of (current?' ':'')+word){if(f.widthOfTextAtSize(current+char,size)>width&&current){lines.push(current);current='';}current+=char;}}lines.push(current);}return lines;}
 function text(value:unknown,x:number,top:number,width:number,size=8,strong=false,color=black){const lines=wrap(value,width,size,strong);lines.forEach((line,i)=>page.drawText(line,{x,y:top-i*(size+3),size,font:strong?bold:font,color}));return lines.length*(size+3);}
 function border(x:number,top:number,w:number,h:number){page.drawRectangle({x,y:top-h,width:w,height:h,borderColor:rgb(.25,.25,.25),borderWidth:.5});}
 function next(){page=doc.addPage([595.28,841.89]);const titleX=logo?100:36,titleWidth=logo?459:523;if(logo){const dim=logo.scaleToFit(54,54);page.drawImage(logo,{x:36,y:778,width:dim.width,height:dim.height});}let size=21;while(bold.widthOfTextAtSize(clean(company.name||'Company name not configured'),size)>titleWidth&&size>9)size--;text(company.name||'Company name not configured',titleX,800,titleWidth,size,true,gold);page.drawLine({start:{x:36,y:773},end:{x:559,y:773},thickness:1,color:blue});text([company.mobile,company.email,company.website].filter(Boolean).join(' | '),36,760,523,8,false,blue);text(title,36,732,523,12,true);y=714;}
 function ensure(h:number){if(y-h<94)next();}
 function paragraph(v:unknown,size=8,strong=false){for(const line of wrap(v,511,size,strong)){ensure(size+5);text(line,42,y,511,size,strong);y-=size+4;}y-=4;}
 function row(values:unknown[],widths:number[],strong=false){const cells=values.map((v,i)=>wrap(v,widths[i]-10,8,strong));let offset=0;const count=Math.max(...cells.map(c=>c.length));while(offset<count){ensure(22);const take=Math.min(count-offset,Math.max(1,Math.floor((y-94-10)/11))),h=Math.max(22,take*11+10);let x=36;cells.forEach((lines,i)=>{border(x,y,widths[i],h);text(lines.slice(offset,offset+take).join('\n'),x+5,y-13,widths[i]-10,8,strong);x+=widths[i];});y-=h;offset+=take;if(offset<count)next();}}
 function finish(){const pages=doc.getPages();pages.forEach((p,i)=>{page=p;text('This is a computer generated document',36,77,523,7);p.drawLine({start:{x:36,y:65},end:{x:559,y:65},color:gold,thickness:2});text(wrap([company.unit1,company.unit2].filter(Boolean).join(' | '),465,6).slice(0,2).join('\n'),36,53,465,6,false,blue);text(`${i+1} / ${pages.length}`,515,53,44,7);});return doc.save();}
 next();return {doc,text,border,wrap,next,ensure,paragraph,row,finish,get y(){return y;},set y(v:number){y=v;}};
}
export async function invoicePdf(record:Row){
 const s=record.snapshot,c=s.company,b=s.customer,d=s.document_details||{},p=await layout(c,(record.status==='DRAFT'?'DRAFT - ':'')+'Tax Invoice');
 const issue=record.generated_at instanceof Date?record.generated_at.toISOString().slice(0,10):String(record.generated_at||'').slice(0,10);
 const seller=[c.name,c.unit1,c.unit2,'GSTIN/UIN: '+(c.gst_no||'Not supplied')].filter(Boolean).join('\n');
 const buyer=['Buyer (Bill to)',b.name,b.address,'GSTIN/UIN: '+(b.gst_no||'Not supplied'),'State code: '+b.state_code].join('\n');
 const metadata=['Invoice No.: '+record.invoice_no,'Dated: '+issue,'Delivery note: '+(d.delivery_note||'-'),'Delivery date: '+(d.delivery_date||'-'),'Payment terms: '+(d.payment_terms||'-'),'Reference: '+(d.reference||'-'),'Rental period: '+s.period_start+' to '+s.period_end].join('\n');
 const top=p.y,h=Math.max(p.wrap(seller,280).length*11+18,p.wrap(metadata,200).length*11+18);if(h>400){p.paragraph(seller,8,true);p.paragraph(metadata);}else{p.border(36,top,300,h);p.border(336,top,223,h);p.text(seller,42,top-13,288,8,true);p.text(metadata,342,top-13,211);p.y-=h;}
 const consignee='Consignee (Ship to)\n'+(d.ship_to||b.name+'\n'+b.address);const buyerText=consignee+'\n\n'+buyer+'\nPlace of supply: '+(d.place_of_supply||b.state_code);
 const delivery=['Dispatch doc.: '+(d.dispatch_document||'-'),'Dispatched through: '+(d.dispatched_through||'-'),'Destination: '+(d.destination||'-'),'Bill of lading / LR-RR: '+(d.lr_number||'-'),'Motor vehicle no.: '+(d.vehicle_no||'-'),'Terms of delivery: '+(d.delivery_terms||'-')].join('\n');
 const bh=Math.max(p.wrap(buyerText,280).length*11+16,p.wrap(delivery,200).length*11+16);if(bh>400){p.paragraph(buyerText);p.paragraph(delivery);}else{p.ensure(bh);p.border(36,p.y,300,bh);p.border(336,p.y,223,bh);p.text(buyerText,42,p.y-13,288);p.text(delivery,342,p.y-13,211);p.y-=bh;}
 const widths=[25,220,58,48,54,40,78];const header=()=>p.row(['Sl.','Description of goods / services','HSN/SAC','Quantity','Rate','Per','Amount'],widths,true);header();let n=0;
 for(const r of s.lines){const description=r.name+'\nRental: '+r.start+' to '+r.end+' ('+r.days+' days)\n'+(r.formula||'');const h=p.wrap(description,210).length*11+10;if(p.y-h<94){p.next();p.paragraph(record.invoice_no+' - continued',9,true);header();}p.row([++n,description,r.hsn,r.quantity,new Decimal(r.rate).toFixed(4),'day',cash(r.amount)],widths);}
 for(const r of s.damages||[]){p.row([++n,r.name+'\nDamage charge: '+r.date,'',r.quantity,cash(r.price),'piece',cash(r.amount)],widths);}
 p.row(['Rental subtotal',cash(s.rental_total)],[445,78]);p.row(['Damage charges',cash(s.damage_total)],[445,78]);p.row(['Taxable value',cash(s.subtotal)],[445,78]);if(d.tax_mode==='CGST_SGST'){const half=new Decimal(s.gst_amount).div(2).toDecimalPlaces(2);p.row(['CGST ('+new Decimal(s.gst_percent).div(2)+'%)',half.toFixed(2)],[445,78]);p.row(['SGST ('+new Decimal(s.gst_percent).div(2)+'%)',new Decimal(s.gst_amount).sub(half).toFixed(2)],[445,78]);}else p.row([(d.tax_mode==='IGST'?'IGST':'GST')+' ('+s.gst_percent+'%)',cash(s.gst_amount)],[445,78]);p.row(['Total INR',cash(s.grand_total)],[445,78],true);
 p.y-=10;p.paragraph('Amount chargeable (in words)',7);p.paragraph(amountWords(s.grand_total),9,true);
 // Display the saved tax totals; do not invent CGST/SGST or IRN data absent from the snapshot.
 const taxable=new Map<string,Decimal>();for(const r of [...s.lines,...(s.damages||[])]){const code=r.hsn||'Unspecified';taxable.set(code,(taxable.get(code)||new Decimal(0)).add(r.amount));}
 const taxRows=[...taxable];let assigned=new Decimal(0),baseAssigned=new Decimal(0),cgstAssigned=new Decimal(0);const split=d.tax_mode==='CGST_SGST',taxWidths=split?[103,120,100,100,100]:[153,140,110,120];
 p.ensure(50);p.row(split?['HSN/SAC','Taxable value','CGST '+new Decimal(s.gst_percent).div(2)+'%','SGST '+new Decimal(s.gst_percent).div(2)+'%','Total tax']:['HSN/SAC','Taxable value',(d.tax_mode==='IGST'?'IGST':'GST')+' rate','Tax amount'],taxWidths,true);
 taxRows.forEach(([code,value],i)=>{baseAssigned=baseAssigned.add(value);const cumulative=i===taxRows.length-1?new Decimal(s.gst_amount):new Decimal(s.subtotal).isZero()?new Decimal(0):baseAssigned.mul(s.gst_amount).div(s.subtotal).toDecimalPlaces(2);const tax=cumulative.sub(assigned);assigned=cumulative;const cumulativeHalf=cumulative.div(2).toDecimalPlaces(2),half=cumulativeHalf.sub(cgstAssigned);cgstAssigned=cumulativeHalf;p.row(split?[code,value.toFixed(2),half.toFixed(2),tax.sub(half).toFixed(2),tax.toFixed(2)]:[code,value.toFixed(2),s.gst_percent+'%',tax.toFixed(2)],taxWidths);});
 p.row(['Total taxable / total tax',cash(s.subtotal),cash(s.gst_amount)],[303,110,110],true);
 p.y-=10;p.paragraph('Tax amount (in words): '+amountWords(s.gst_amount),8,true);
 if(record.payments){let paid=new Decimal(0);p.paragraph('Payment details (as of export)',9,true);for(const r of record.payments){paid=paid.add(r.total);p.paragraph(r.date+' | '+r.voucher_no+' | Received INR '+cash(r.total));}p.paragraph('Payments received: INR '+paid.toFixed(2)+' | Invoice balance due: INR '+new Decimal(s.grand_total).sub(paid).toFixed(2),9,true);}
 p.ensure(120);p.paragraph('Company bank details',9,true);p.paragraph('Bank: '+(c.bank_name||'Not configured')+'\nAccount No.: '+(c.bank_account||'Not configured')+'\nIFSC: '+(c.bank_ifsc||'Not configured'));
 if(s.notes)p.paragraph('Notes: '+s.notes);if(c.terms)p.paragraph('Terms / declaration: '+c.terms);
 p.ensure(48);p.y-=12;p.paragraph('For '+c.name,9,true);p.y-=15;p.paragraph('Authorised signatory',8);
 return p.finish();
}
export async function voucherPdf(v:Row,company:Row){
 const p=await layout(company,v.type+' Voucher');p.paragraph('Voucher No.: '+v.voucher_no+' | Date: '+v.date,10,true);p.paragraph('Reference: '+(v.reference||'-'));p.row(['Particulars','Debit INR','Credit INR'],[303,110,110],true);
 for(const l of v.lines)p.row([l.name,cash(l.debit),cash(l.credit)],[303,110,110]);p.row(['Total',cash(v.total),cash(v.total)],[303,110,110],true);p.y-=12;p.paragraph('Narration: '+v.narration);const b=v.details?.buyer;if(b?.mailing_name)p.paragraph('Party: '+b.mailing_name+'\n'+b.address+'\nGSTIN: '+(b.gstin||'-'));
 for(const [key,label] of Object.entries({delivery_note:'Delivery note',dispatch_document:'Dispatch document',dispatched_through:'Dispatched through',destination:'Destination',carrier:'Carrier',lr_number:'LR number',lr_date:'LR date',vehicle_no:'Vehicle number'})){if(v.details?.[key])p.paragraph(label+': '+v.details[key]);}
 p.ensure(60);p.y-=20;p.paragraph('Prepared by __________________     Authorised signatory __________________');return p.finish();
}
