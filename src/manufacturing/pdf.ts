import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
type Row=Record<string,any>;
export async function manufacturingPdf(kind:string,record:Row){
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 let page=pdf.addPage([595.28,841.89]),y=795;
 const clean=(v:unknown)=>String(v??'').replaceAll('₹','INR ').replace(/[\u2018\u2019]/g,"'").replace(/[\u2013\u2014]/g,'-').replace(/[^\x20-\x7e\xa0-\xff\n]/g,'');
 function line(value:unknown,size=10,strong=false,x=40){if(y<55){page=pdf.addPage([595.28,841.89]);y=790;}page.drawText(clean(value),{x,y,size,font:strong?bold:font,color:rgb(.13,.2,.24)});y-=size+7;}
 function wrapped(value:unknown,size=9,strong=false,width=510){for(const paragraph of clean(value).split('\n')){let current='';for(const word of paragraph.split(' ')){if(font.widthOfTextAtSize(current+' '+word,size)>width&&current){line(current,size,strong);current=word;}else current+=(current?' ':'')+word;}line(current,size,strong);}}
 const titles:Row={purchase:'PURCHASE ORDER',sales:'SALES ORDER',invoice:'SALES INVOICE',receipt:'GOODS RECEIPT',dispatch:'DISPATCH NOTE'};
 const snapshot=kind==='invoice'?record.snapshot:null;
 const company=snapshot?.company;
 if(company){
  if(company.logo){try{const bytes=Buffer.from(company.logo.split(',')[1],'base64'),image=company.logo.startsWith('data:image/png')?await pdf.embedPng(bytes):company.logo.startsWith('data:image/jpeg')?await pdf.embedJpg(bytes):null;if(image){const size=image.scaleToFit(100,40);page.drawImage(image,{x:40,y:y-30,width:size.width,height:size.height});y-=50;}}catch{}}
  wrapped(company.name,16,true);wrapped(company.unit1,8);wrapped(company.unit2,8);wrapped(`${company.mobile} | ${company.email}`,8);wrapped(`${company.website} | GSTIN: ${company.gst_no||'Not set'}`,8);
 }else{line('JYOTI ENGINEERING & SCAFFOLD',16,true);line('Manufacturing operations',9);}
 y-=12;line(titles[kind],15,true);
 const number=record.invoice_no||record.po_no||record.so_no||record.receipt_no||record.dispatch_no;
 line(`${number}   |   ${record.date}   |   ${record.status||'POSTED'}`,10,true);
 const party=snapshot?.customer||record.party_snapshot;if(party){wrapped(`${kind==='purchase'?'Supplier':'Customer'}: ${party.name}`,11,true);wrapped(party.address);line(`GST: ${party.gst_no||'-'} | Contact: ${party.contact||''} ${party.mobile||''}`,9);}
 if(snapshot)line('Sales order: '+snapshot.order_no,9);
 y-=15;
 const rows=snapshot?.lines||record.lines,priced=['purchase','sales','invoice'].includes(kind);
 const widths=[40,66,290,344,395,460,555],headings=['Sr','Description / HSN','Quantity','Unit','Rate (INR)','Amount (INR)'];
 function header(){page.drawRectangle({x:40,y:y-6,width:515,height:23,color:rgb(.9,.94,.95)});headings.forEach((h,i)=>page.drawText(priced||i<4?h:'',{x:widths[i]+3,y,size:8,font:bold}));y-=27;}
 function words(value:string,width:number){const result:string[]=[];let current='';for(const word of clean(value).split(' ')){if(font.widthOfTextAtSize(current+' '+word,9)>width&&current){result.push(current);current=word;}else current+=(current?' ':'')+word;}if(current)result.push(current);return result;}
 header();
 rows.forEach((r:Row,index:number)=>{
  const name=words(r.name,215),height=Math.max(29,name.length*12+(r.hsn_code?12:0)+10);
  if(y-height<70){page=pdf.addPage([595.28,841.89]);y=792;line(number+' - continued',9,true);header();}
  const values=[String(index+1),'',String(r.quantity),r.unit||'pc',priced?Number(r.rate).toFixed(4).replace(/0+$/,'').replace(/\.$/,''):'',priced?Number(r.amount).toFixed(2):''];
  values.forEach((v,i)=>page.drawText(clean(v),{x:widths[i]+3,y,size:9,font}));name.forEach((v,i)=>page.drawText(v,{x:69,y:y-i*12,size:9,font:bold}));if(r.hsn_code)page.drawText('HSN: '+clean(r.hsn_code),{x:69,y:y-name.length*12,size:8,font});
  y-=height;page.drawLine({start:{x:40,y:y+8},end:{x:555,y:y+8},thickness:.5,color:rgb(.84,.88,.89)});
 });
 y-=15;
 if(priced){if(y<190){page=pdf.addPage([595.28,841.89]);y=790;}if(snapshot){line(`Subtotal: INR ${snapshot.subtotal}`,11,true,315);line(`GST (${snapshot.gst_percent}%): INR ${snapshot.gst_amount}`,10,false,315);line(`TOTAL: INR ${snapshot.grand_total}`,14,true,315);}else line(`ORDER TOTAL: INR ${record.total_amount}`,13,true,285);}
 y-=10;wrapped(snapshot?.notes||record.notes||'',9);
 if(company){y-=15;wrapped(`Bank: ${company.bank_name} | A/c: ${company.bank_account} | IFSC: ${company.bank_ifsc}`,9,true);wrapped('Goods supplied against the referenced sales order. '+(snapshot.notes||''),8);}
 pdf.getPages().forEach((p,i)=>p.drawText(`Jyoti Manufacturing | ${number} | Page ${i+1} of ${pdf.getPageCount()}`,{x:40,y:26,size:8,font}));return pdf.save();
}
