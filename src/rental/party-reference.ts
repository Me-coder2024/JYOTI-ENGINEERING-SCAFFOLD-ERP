import {PDFDocument,StandardFonts} from 'pdf-lib';
import ExcelJS from 'exceljs';
import Decimal from 'decimal.js';
import type {LedgerFormat} from './ledger-formats';
type Row=Record<string,any>;
const clean=(v:unknown)=>String(v??'').replace(/[^\x20-\x7e\n]/g,' ');
const date=(v:string)=>new Date(v+'T00:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'2-digit',timeZone:'UTC'}).replaceAll(' ','-');
const money=(v:unknown)=>Number(v||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
export function referenceRows(summary:Row,vouchers:Row[],ledger:string,start:string){
 const opening=new Decimal(summary.opening),closing=new Decimal(summary.closing);
 const rows:Row[]=[{date:start,side:opening.gte(0)?'To':'By',particulars:'Opening Balance',debit:opening.gt(0)?opening.toNumber():0,credit:opening.lt(0)?opening.abs().toNumber():0,strong:true}];
 for(const r of summary.rows){
  const v=vouchers.find(v=>v.id===r.id);
  const other=(v?.lines||[]).filter((l:Row)=>l.ledger_id!==ledger).map((l:Row)=>l.name).filter(Boolean);
  rows.push({date:r.date,side:Number(r.debit)>0?'To':'By',particulars:[...new Set(other)].join(', ')||r.narration,type:r.type,no:r.reference,debit:Number(r.debit),credit:Number(r.credit)});
 }
 const debit=opening.gt(0)?opening.add(summary.debit):new Decimal(summary.debit);
 const credit=opening.lt(0)?opening.abs().add(summary.credit):new Decimal(summary.credit);
 rows.push({debit:debit.toNumber(),credit:credit.toNumber(),rule:true});
 rows.push({side:closing.gte(0)?'By':'To',particulars:'Closing Balance',debit:closing.lt(0)?closing.abs().toNumber():0,credit:closing.gt(0)?closing.toNumber():0,strong:true});
 rows.push({debit:Decimal.max(debit,credit).toNumber(),credit:Decimal.max(debit,credit).toNumber(),strong:true,rule:true});
 return rows;
}
export async function renderPartyReference(report:Row,settings:LedgerFormat,format:'pdf'|'xlsx'){
 const rows=report.rows,headers=['Date','','Particulars','Vch Type','Vch No.','Debit','Credit'];
 const top=[settings.heading,report.companyAddress,report.party,'Ledger Account',...String(report.address||'').split('\n'),date(report.start)+' to '+date(report.end)];
 if(format==='xlsx'){
  const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Party Ledger');
  sheet.columns=[{width:14},{width:5},{width:40},{width:16},{width:22},{width:19},{width:19}];
  for(const [i,value] of top.entries()){const n=sheet.rowCount+1;sheet.mergeCells(n,1,n,7);const c=sheet.getCell(n,1);c.value=value;c.font={name:'Arial',size:i===0||i===2?14:11,bold:i===0||i===2};c.alignment={horizontal:'center',wrapText:true};sheet.getRow(n).height=23;}
  const header=sheet.addRow(headers);header.font={bold:true};header.eachCell(c=>c.border={top:{style:'thin'},bottom:{style:'thin'}});
  for(const row of rows){const r=sheet.addRow([row.date?date(row.date):'',row.side||'',row.particulars||'',row.type||'',row.no||'',row.debit||null,row.credit||null]);r.font={name:'Arial',size:11,bold:!!row.strong};r.alignment={vertical:'top',wrapText:true};r.height=Math.max(22,Math.ceil(String(row.particulars||'').length/36)*16);for(const i of [6,7]){r.getCell(i).numFmt='#,##0.00';if(row.rule)r.getCell(i).border={top:{style:'thin'},...(row.strong?{bottom:{style:'double' as const}}:{})};}}
  if(settings.footer)sheet.addRow([settings.footer]);
  sheet.pageSetup={paperSize:9,orientation:settings.orientation,fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:'1:'+header.number};
  return {bytes:new Uint8Array(await book.xlsx.writeBuffer()),extension:'xlsx',type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
 }
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const [w,h]=settings.orientation==='landscape'?[841.89,595.28]:[595.28,841.89],left=35,usable=w-70;
 const widths=[.095,.035,.30,.14,.14,.145,.145].map(n=>n*usable),xs=widths.map((_,i)=>left+widths.slice(0,i).reduce((a,b)=>a+b,0));
 const size=settings.font_size+1;
 let page=pdf.addPage([w,h]),y=h-40;
 const draw=(s:unknown,x:number,yy:number,strong=false,sz=size)=>page.drawText(clean(s),{x,y:yy,size:sz,font:strong?bold:font});
 const wrap=(s:unknown,width:number)=>{const out:string[]=[];let line='';for(const ch of clean(s)){if(ch==='\n'||bold.widthOfTextAtSize(line+ch,size)>width){out.push(line);line='';}if(ch!=='\n')line+=ch;}if(line)out.push(line);return out.length?out:[''];};
 function heading(){
  for(const [i,value] of top.entries()){const sz=i===0||i===2?12:9;for(const t of wrap(value,usable)){draw(t,(w-(i===0||i===2?bold:font).widthOfTextAtSize(t,sz))/2,y,i===0||i===2,sz);y-=i===0||i===2?16:12;}}
  y-=14;draw('Page '+pdf.getPageCount(),w-68,y,false,8);y-=12;
  page.drawLine({start:{x:left,y:y+10},end:{x:w-left,y:y+10},thickness:.5});
  headers.forEach((t,i)=>draw(t,xs[i]+2,y,i===2||i>4,8));y-=5;
  page.drawLine({start:{x:left,y},end:{x:w-left,y},thickness:.5});y-=14;
 }
 heading();
 for(const r of rows){
  const texts=[r.date?date(r.date):'',r.side||'',r.particulars||'',r.type||'',r.no||'',r.debit?money(r.debit):'',r.credit?money(r.credit):''];
  const lines=texts.map((t,i)=>wrap(t,widths[i]-5)),count=Math.max(...lines.map(l=>l.length));
  if(y-count*(size+3)<42){page=pdf.addPage([w,h]);y=h-40;heading();}
  if(r.rule)page.drawLine({start:{x:xs[5],y:y+size+3},end:{x:w-left,y:y+size+3},thickness:.5});
  for(let n=0;n<count;n++){
   lines.forEach((ls,i)=>{if(ls[n])draw(ls[n],i>4?xs[i]+widths[i]-(r.strong?bold:font).widthOfTextAtSize(ls[n],size)-2:xs[i]+2,y,!!r.strong);});
   y-=size+3;
  }
  if(r.rule&&r.strong)page.drawLine({start:{x:xs[5],y:y+1},end:{x:w-left,y:y+1},thickness:1});
 }
 for(const p of pdf.getPages())if(settings.footer)p.drawText(clean(settings.footer),{x:left,y:22,size:7,font});
 return {bytes:await pdf.save(),extension:'pdf',type:'application/pdf'};
}
