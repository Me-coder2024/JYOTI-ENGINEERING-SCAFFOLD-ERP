import {readFile} from 'node:fs/promises';
import {PDFDocument,StandardFonts,rgb,type PDFPage,type PDFImage} from 'pdf-lib';
import {defaultChallanFormat,type ChallanFormat} from './challan-format';
type Row=Record<string,any>;
const clean=(v:unknown)=>String(v??'').replaceAll('₹','INR ').replace(/[–—]/g,'-').replace(/[^\x20-\x7e\n]/g,'');
const date=(v:string)=>v?.slice(0,10).split('-').reverse().join('/')||'';

export async function challanPdf(rows:Row[],company:Row,settings:ChallanFormat=defaultChallanFormat()){
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
 if(!rows.length)throw new Error('No challan items found.');
 const first=rows[0],title=first.type==='RETURN'?settings.inward_title:settings.outward_title,bodySize=settings.font_size,lineHeight=bodySize+3,companyName=settings.heading||company.name||'JYOTI ENGINEERING';
 let logo:PDFImage|undefined;
 try{logo=company.logo?.startsWith('data:image/jpeg;')?await doc.embedJpg(Buffer.from(company.logo.split(',')[1],'base64')):await doc.embedPng(company.logo?.startsWith('data:image/png;')?Buffer.from(company.logo.split(',')[1],'base64'):await readFile('public/branding/jyoti-logo.png'));}catch{}
 let page:PDFPage,y=0;const x=24,w=547,right=571;
 function wrap(v:unknown,width:number,size=bodySize,strong=false){
  const out:string[]=[],f=strong?bold:font;
  for(const part of clean(v).split('\n')){
   let line='';
   for(const word of part.split(/\s+/).filter(Boolean)){
    const candidate=line?line+' '+word:word;
    if(f.widthOfTextAtSize(candidate,size)<=width){line=candidate;continue;}
    if(line){out.push(line);line='';}
    for(const char of word){if(line&&f.widthOfTextAtSize(line+char,size)>width){out.push(line);line='';}line+=char;}
   }
   out.push(line);
  }
  return out;
 }
 function text(v:unknown,xx:number,top:number,width:number,size=bodySize,strong=false,center=false){const f=strong?bold:font;wrap(v,width,size,strong).forEach((t,i)=>page.drawText(t,{x:center?xx+(width-f.widthOfTextAtSize(t,size))/2:xx,y:top-size-i*(size+3),font:f,size}));}
 function box(xx:number,top:number,ww:number,h:number){page.drawRectangle({x:xx,y:top-h,width:ww,height:h,borderColor:rgb(0,0,0),borderWidth:.65});}
 function newPage(){
  page=doc.addPage([595.28,841.89]);
  let nameSize=24;const name=clean(companyName);while(bold.widthOfTextAtSize(name,nameSize)>447&&nameSize>12)nameSize--;
  if(logo&&settings.show_logo){const size=logo.scaleToFit(78,85);page.drawImage(logo,{x,y:815-size.height,width:size.width,height:size.height});}
  text(name,110,816,461,nameSize,true,true);
  const details=[company.business_description,[company.udyam_no?'MSME: '+company.udyam_no:'',company.gst_no?'GSTIN: '+company.gst_no:''].filter(Boolean).join('    '),company.unit1,company.unit2,[company.mobile?'Mobile: '+company.mobile:'',company.email?'E-mail: '+company.email:''].filter(Boolean).join('    '),company.website?'Web: '+company.website:''].filter(Boolean).join('\n');
  text(details,110,784,461,8,false,true);
  y=Math.min(716,784-wrap(details,461,8).length*11-10);
  const titleHeight=Math.max(23,wrap(title,w-12,12,true).length*15+8);box(x,y,w,titleHeight);text(title,x+6,y-4,w-12,12,true,true);y-=titleHeight;
  const to='To,\n'+first.customer+'\n'+(first.address||''),meta='Challan Date: '+date(first.date)+'\nChallan No.: '+(first.reference||'Legacy entry')+'\nVehicle No.: '+(first.vehicle_no||'-');
  const h=Math.max(66,wrap(to,263).length*lineHeight+12,wrap(meta,264).length*lineHeight+12);
  box(x,y,274,h);box(298,y,273,h);text(to,x+6,y-6,262);text(meta,304,y-6,261);y-=h;
  const address='Site address:\n'+(first.delivery_site?.trim()||''),contact='Contact: '+(first.contact_person||'-')+'\nPhone / Mobile: '+(first.contact_phone||first.mobile||'-');
  const ah=Math.max(62,wrap(address,262).length*lineHeight+12,wrap(contact,261).length*lineHeight+12);
  box(x,y,274,ah);box(298,y,273,ah);text(address,x+6,y-6,262);text(contact,304,y-6,261);y-=ah;
  [ [x,35,'No.'],[x+35,432,'Item Name & Description'],[x+467,80,'Qty.'] ].forEach(([xx,ww,label])=>{box(Number(xx),y,Number(ww),23);text(label,Number(xx),y-5,Number(ww),9,true,true);});y-=23;
 }
 function itemRow(label:string,qty:string,n:string,height:number){
  box(x,y,35,height);box(x+35,y,432,height);box(x+467,y,80,height);
  text(n,x+5,y-7,25);text(label,x+42,y-7,418);text(qty,x+474,y-7,66,9,false,true);y-=height;
 }
 newPage();let total=0;
 for(let i=0;i<rows.length;i++){
  const r=rows[i],label=r.item+(r.damaged_quantity?' (damaged: '+r.damaged_quantity+')':'')+' — '+(r.stock_type||'Rent');
  const lines=wrap(label,418);let offset=0;
  while(offset<lines.length){
   const bottom=settings.footer?220:190;
   if(y<bottom+31)newPage();
   const count=Math.min(lines.length-offset,Math.max(1,Math.floor((y-bottom-14)/lineHeight)));
   itemRow(lines.slice(offset,offset+count).join('\n'),offset===0?String(r.quantity):'',offset===0?String(i+1):'',Math.max(30,count*lineHeight+14));offset+=count;
   if(offset<lines.length)newPage();
  }
  total+=Number(r.quantity);
 }
 const notes=[...new Set(rows.map(r=>r.note?.trim()).filter(Boolean))].join('\n');
 const notesHeight=notes?(wrap(notes,w-12).length+1)*lineHeight+12:0;
 // Retain the reference's writing area without allowing it to overflow A4.
 if(settings.layout==='reference'&&y>240+notesHeight)itemRow('','','',y-240-notesHeight);
 box(x,y,467,26);box(x+467,y,80,26);text('TOTAL',x+375,y-6,85,10,true,true);text(total,x+474,y-6,66,10,true,true);y-=26;
 if(notes){
  const noteLines=wrap(notes,w-12);let offset=0;
  while(offset<noteLines.length){if(y<230)newPage();const count=Math.min(noteLines.length-offset,Math.max(1,Math.floor((y-200)/lineHeight)-2));const height=(count+1)*lineHeight+12;box(x,y,w,height);text(offset?'Notes (continued)':'Notes',x+6,y-6,w-12,bodySize,true);text(noteLines.slice(offset,offset+count).join('\n'),x+6,y-6-lineHeight,w-12);y-=height;offset+=count;}
 }

 box(x,y,380,55);box(x+380,y,167,55);text('Goods not for sale\nReturnable goods',x+6,y-6,140,8);text('Above material counted by the truck driver',x+150,y-6,224,8);text('For, '+companyName,x+386,y-6,155,9,true,true);y-=55;
 box(x,y,w,58);text('Receiver\'s Signature',x+25,y-39,240,9,false,true);text('Authorised Signature',x+330,y-39,205,9,false,true);
 for(const [i,p] of doc.getPages().entries()){if(settings.footer){const footerLines=wrap(settings.footer,w,8);footerLines.forEach((line,n)=>p.drawText(line,{x:24,y:38+(footerLines.length-1-n)*11,size:8,font}));}p.drawText('Powered by SnapAi  |  '+(i+1)+' / '+doc.getPageCount(),{x:24,y:20,size:8,font});}
 return doc.save();
}
