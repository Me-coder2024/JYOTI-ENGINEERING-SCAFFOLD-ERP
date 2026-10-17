import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import Decimal from 'decimal.js';
import {quotationDocuments,quotationTerms} from './quotation-defaults';
type Row=Record<string,any>;
export function quotationAmounts(s:Row){
 const sum=(f:(l:Row)=>Decimal)=>s.lines.reduce((n:Decimal,l:Row)=>n.add(f(l)),new Decimal(0));
 const daily=sum(l=>new Decimal(l.rate).mul(l.quantity)),monthly=sum(l=>new Decimal(l.monthly_total)),material=sum(l=>new Decimal(l.material_total)),unit=sum(l=>new Decimal(l.material_value||0));
 const tax=new Decimal(s.gst_percent??s.company.gst_percent??0);
 const taxed=(v:Decimal)=>v.mul(tax).div(100).toDecimalPlaces(2);
 return {daily,monthly,material,unit,tax,dailyTax:taxed(daily),monthlyTax:taxed(monthly),materialTax:taxed(material),unitTax:taxed(unit),quantity:sum(l=>new Decimal(l.quantity)),weight:sum(l=>new Decimal(l.weight_total??new Decimal(l.weight||0).mul(l.quantity)))};
}
export async function quotationPdf(record:Row){
 const s=record.snapshot,c=s.company,customer=s.customer,a=quotationAmounts(s);
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const logo=await pdf.embedPng(await readFile(path.join(process.cwd(),'public/branding/jyoti-logo.png')));
 const W=612,H=792,L=51,R=522,width=471;let page=pdf.addPage([W,H]),y=0;
 const clean=(v:unknown)=>String(v??'').replaceAll('₹','INR ').replace(/[^\x20-\x7e\n]/g,' ');
 const wrap=(v:unknown,w:number,size=7,strong=false)=>{const f=strong?bold:font,ls:string[]=[];for(const para of clean(v).split('\n')){let line='';for(const word of para.split(' ')){if(f.widthOfTextAtSize(line+(line?' ':'')+word,size)>w&&line){ls.push(line);line='';}for(const ch of (line?' ':'')+word){if(f.widthOfTextAtSize(line+ch,size)>w&&line){ls.push(line);line='';}line+=ch;}}ls.push(line);}return ls;};
 const text=(v:unknown,x:number,top:number,size=7,strong=false)=>page.drawText(clean(v),{x,y:top,size,font:strong?bold:font});
 const center=(v:unknown,top:number,size=8,strong=false)=>text(v,(W-(strong?bold:font).widthOfTextAtSize(clean(v),size))/2,top,size,strong);
 function head(){
  page.drawImage(logo,{x:L,y:H-126,width:78,height:78});
  page.drawRectangle({x:130,y:H-73,width:392,height:19,color:rgb(.62,.62,.62),borderColor:rgb(.3,.3,.3),borderWidth:.5});
  const name=clean(c.name||'JYOTI ENGINEERING').toUpperCase(),sz=Math.min(17,380/bold.widthOfTextAtSize(name,1));
  page.drawText(name,{x:130+(392-bold.widthOfTextAtSize(name,sz))/2,y:H-69,size:sz,font:bold,color:rgb(.08,.53,.78)});
  let yy=H-83;
  for(const line of [c.unit1,c.mobile?'Mob:- '+c.mobile:'',c.email?'E-Mail:- '+c.email:'',c.website].filter(Boolean)){for(const t of wrap(line,310,6.5)){text(t,208,yy,6.5);yy-=10;}}
  page.drawRectangle({x:L,y:H-137,width,height:12,color:rgb(.84,.84,.84)});
  center('Quotation',H-134,8,true);center('For Scaffolding Material Rental Service',H-145,7);
  text('Reference No:- '+(s.reference||'JE/'+record.id.slice(0,8).toUpperCase()),L,H-156);
  const date=new Date(s.date+'T00:00:00Z').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'2-digit',timeZone:'UTC'}).replaceAll(' ','-');
  y=H-166;
  const names=wrap('TO:- '+customer.name,153,7,true);names.forEach((v,i)=>text(v,L,y-i*9,7,true));
  text('GST No: '+(customer.gst_no||'-'),208,y,7,true);text(date,481,y,7);
  y-=Math.max(1,names.length)*9-5;
 }
 function ensure(h:number){if(y-h<35){page=pdf.addPage([W,H]);head();}}
 const widths=[36,120,68,36,36,42,36,48,49];
 function row(values:unknown[],strong=false,header=false,highlight=false){
  const size=header?6:6.5,ls=values.map((v,i)=>wrap(v,widths[i]-4,size,strong)),height=Math.max(header?40:11,...ls.map(l=>l.length*(size+2)+4));
  ensure(height);
  let x=L;values.forEach((_,i)=>{page.drawRectangle({x,y:y-height,width:widths[i],height,borderColor:rgb(0,0,0),borderWidth:.5,...(header&&i===8?{color:rgb(1,.76,0)}:highlight?{color:rgb(1,1,.72)}:{})});ls[i].forEach((v,n)=>{const right=i>=2&&!header;const xx=right?x+widths[i]-2-(strong?bold:font).widthOfTextAtSize(v,size):x+2;text(v,xx,y-size-3-n*(size+2),size,strong);});x+=widths[i];});y-=height;
 }
 function paragraph(v:unknown,strong=false,yellow=false){
  const ls=wrap(v,width-8,6.5,strong);ensure(ls.length*10+2);
  if(yellow)page.drawRectangle({x:L,y:y-ls.length*10-2,width,height:ls.length*10+3,color:rgb(1,1,0)});
  ls.forEach(t=>{text(t,L+4,y-8,6.5,strong);y-=10;});y-=0;
 }
 const cash=(v:Decimal.Value)=>new Decimal(v).toFixed(2);
 head();
 const headers=['Sr No','Description','Qty','Unit Rate','Amt/Day','Amt/Month','Material Value /Per Piece','Actual Material Cost','Weight/Kgs'];
 row(headers,true,true);
 for(const [i,l] of s.lines.entries()){
  if(y-35<35){page=pdf.addPage([W,H]);head();row(headers,true,true);}
  row([i+1,l.name,l.quantity,cash(l.rate),cash(new Decimal(l.rate).mul(l.quantity)),cash(l.monthly_total),cash(l.material_value),cash(l.material_total),l.weight_total!=null||l.weight!=null?cash(l.weight_total??new Decimal(l.weight).mul(l.quantity)):'-']);
 }
 row(['','Total',cash(a.quantity),'',cash(a.daily),cash(a.monthly),cash(a.unit),cash(a.material),cash(a.weight)]);
 function summary(label:string,values:string[]){
  ensure(12);let x=L+widths[0]+widths[1];
  const ws=[widths[2]+widths[3],...widths.slice(4)];
  [label,...values].forEach((v,i)=>{page.drawRectangle({x,y:y-11,width:ws[i],height:11,borderColor:rgb(.9,.85,0),borderWidth:.6});const size=6.5; text(v,x+ws[i]-3-bold.widthOfTextAtSize(v,size),y-8,size,true);x+=ws[i];});y-=11;
 }
 summary('GST @'+a.tax+'%',[cash(a.dailyTax),cash(a.monthlyTax),cash(a.unitTax),cash(a.materialTax),cash(a.weight.div(1000))+' MT']);
 summary('Grand Total',[cash(a.daily.add(a.dailyTax)),cash(a.monthly.add(a.monthlyTax)),cash(a.unit.add(a.unitTax)),cash(a.material.add(a.materialTax)),'']);
 y-=5;
 paragraph('Note:-(1) Minimum '+customer.locking_days+' Days rent will be locking period thereafter per day per piece rate will apply',false,true);
 paragraph('PDC 1     INR '+cash(a.material.add(a.materialTax))+'     Material Value Cheque');
 paragraph('PDC 2     INR '+cash(a.monthly.add(a.monthlyTax))+'     Monthly Rental');
 paragraph('Deposit Amt     INR '+cash(s.deposit));
 if(s.pdc_terms)paragraph('PDC terms: '+s.pdc_terms);
 paragraph('Note:-(2) Dispatch After '+(s.dispatch_days??7)+' Days of receiving deposit amount.',false,true);
 paragraph('Terms & Condition',true);
 for(const [i,t] of String(s.terms||quotationTerms).split('\n').filter(Boolean).entries())paragraph((i+1)+'   '+t);
 y-=8;paragraph('Required Document',true);
 for(const [i,t] of String(s.required_documents||quotationDocuments).split('\n').filter(Boolean).entries())paragraph((i+1)+'   '+t);
 y-=15;paragraph('Account Details',true);paragraph(c.bank_name||c.name,true);paragraph('A/c No   '+(c.bank_account||'Not configured'),true);paragraph('IFSC CODE   '+(c.bank_ifsc||'Not configured'),true);
 pdf.getPages().forEach((p,i)=>p.drawText('Quotation | '+(i+1)+' / '+pdf.getPageCount(),{x:L,y:20,size:6,font}));
 return pdf.save();
}
