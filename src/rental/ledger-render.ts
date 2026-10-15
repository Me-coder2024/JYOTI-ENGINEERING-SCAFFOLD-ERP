import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import ExcelJS from 'exceljs';
import type {LedgerFormat} from './ledger-formats';
export type ReportRow={values:Record<string,string|number>;strong?:boolean};
export type LedgerReport={party:string;address:string;start:string;end:string;rows:ReportRow[]};
export async function renderLedger(report:LedgerReport,settings:LedgerFormat,format:'pdf'|'xlsx'){
 const columns=settings.columns;
 const numeric=(c:string)=>['Issu Qty','Rcpt Qty','Pend.Qty','Debit','Credit','Balance'].includes(c);
 const widths=columns.map(c=>['Item Name','Particulars'].includes(c)?3:['Reference'].includes(c)?1.5:1);
 if(format==='xlsx'){
  const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Ledger');
  sheet.columns=columns.map((c,i)=>({width:widths[i]*15}));
  const top=[settings.heading,settings.title,'Statement Of: '+report.party,report.address,'From: '+report.start+'    To: '+report.end];
  top.forEach((t,i)=>{sheet.mergeCells(i+1,1,i+1,columns.length);const cell=sheet.getCell(i+1,1);cell.value=t;cell.alignment={wrapText:true,horizontal:i<2?'center':'left'};cell.font={size:i===0?16:settings.font_size+2,bold:i<2};sheet.getRow(i+1).height=i===3?32:25;if(i===0){cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFE6E6E6'}};cell.border={top:{style:'thin'},bottom:{style:'thin'},left:{style:'thin'},right:{style:'thin'}};}});
  sheet.addRow(columns).font={bold:true,size:settings.font_size+2};
  for(const row of report.rows){const r=sheet.addRow(columns.map(c=>row.values[c]??''));r.font={size:settings.font_size+2,bold:!!row.strong};r.alignment={wrapText:true,vertical:'top'};r.height=Math.max(22,...columns.map((c,i)=>Math.ceil(String(row.values[c]??'').length/(widths[i]*13))*15));columns.forEach((c,i)=>{if(numeric(c)){r.getCell(i+1).numFmt='0.00';r.getCell(i+1).alignment={horizontal:'right'};}if(row.strong)r.getCell(i+1).border={top:{style:'thin'}};});}
  if(settings.footer){sheet.mergeCells(sheet.rowCount+1,1,sheet.rowCount+1,columns.length);sheet.getRow(sheet.rowCount).getCell(1).value=settings.footer;}
  sheet.pageSetup={paperSize:9,orientation:settings.orientation,fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:'1:6',margins:{left:.3,right:.3,top:.4,bottom:.4,header:.2,footer:.2}};
  sheet.views=[{state:'frozen',ySplit:6}];
  return {bytes:new Uint8Array(await book.xlsx.writeBuffer()),type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',extension:'xlsx'};
 }
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const [w,h]=settings.orientation==='portrait'?[595.28,841.89]:[841.89,595.28],margin=28,usable=w-margin*2;
 const sum=widths.reduce((a,b)=>a+b,0),sizes=widths.map(n=>n/sum*usable),xs=sizes.map((_,i)=>margin+sizes.slice(0,i).reduce((a,b)=>a+b,0));
 const clean=(s:unknown)=>String(s??'').replace(/[^\x20-\x7e]/g,' ');
 const wrap=(value:unknown,width:number,size:number,strong=false)=>{
  const f=strong?bold:font,lines:string[]=[];let line='';
  for(const word of clean(value).split(' ')){
   const candidate=line?line+' '+word:word;
   if(f.widthOfTextAtSize(candidate,size)<=width){line=candidate;continue;}
   if(line){lines.push(line);line='';}
   for(const ch of word){if(f.widthOfTextAtSize(line+ch,size)>width&&line){lines.push(line);line='';}line+=ch;}
  }
  lines.push(line);return lines;
 };
 let page!:ReturnType<typeof pdf.addPage>;let y=0;
 function draw(value:unknown,x:number,yy:number,size=settings.font_size,strong=false){page.drawText(clean(value),{x,y:yy,size,font:strong?bold:font});}
 function newPage(){
  page=pdf.addPage([w,h]);
  const titleSize=Math.min(14,usable/bold.widthOfTextAtSize(clean(settings.heading),1));
  page.drawRectangle({x:margin,y:h-55,width:usable,height:26,borderColor:rgb(0,0,0),borderWidth:1,color:rgb(.9,.9,.9)});
  draw(settings.heading,(w-bold.widthOfTextAtSize(clean(settings.heading),titleSize))/2,h-47,titleSize,true);
  draw(settings.title,margin,h-74,10,true);
  const names=wrap('Statement Of: '+report.party,usable,9);names.forEach((s,i)=>draw(s,margin,h-90-i*11,9));
  const address=wrap(report.address,usable,8);address.forEach((s,i)=>draw(s,margin,h-93-names.length*11-i*10,8));
  y=h-107-names.length*11-address.length*10;draw('From: '+report.start+'    To: '+report.end,margin,y,8);y-=20;
  const heads=columns.map((c,i)=>wrap(c,sizes[i]-8,settings.font_size,true));
  heads.forEach((ls,i)=>ls.forEach((s,n)=>draw(s,xs[i]+3,y-n*(settings.font_size+2),settings.font_size,true)));
  y-=Math.max(...heads.map(ls=>ls.length))*(settings.font_size+2)+8;
 }
 newPage();
 for(const row of report.rows){
  const cells=columns.map((c,i)=>wrap(typeof row.values[c]==='number'?row.values[c].toFixed(2):row.values[c]??'',sizes[i]-8,settings.font_size,!!row.strong));
  const count=Math.max(...cells.map(c=>c.length)),lineHeight=settings.font_size+3;
  if(y-lineHeight<48)newPage();
  if(row.strong)page.drawLine({start:{x:margin,y:y+settings.font_size+3},end:{x:w-margin,y:y+settings.font_size+3},thickness:.4});
  for(let n=0;n<count;n++){
   if(y-lineHeight<48)newPage();
   cells.forEach((ls,i)=>{if(ls[n]!==undefined){const f=row.strong?bold:font;const x=numeric(columns[i])?xs[i]+sizes[i]-4-f.widthOfTextAtSize(ls[n],settings.font_size):xs[i]+3;draw(ls[n],x,y,settings.font_size,!!row.strong);}});
   y-=lineHeight;
  }
  y-=5;
 }
 pdf.getPages().forEach((p,i)=>{p.drawText(clean(settings.footer),{x:margin,y:20,size:6,font});p.drawText((i+1)+' / '+pdf.getPageCount(),{x:w-58,y:32,size:7,font});});
 return {bytes:await pdf.save(),type:'application/pdf',extension:'pdf'};
}
