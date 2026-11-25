import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument,PDFRawStream,decodePDFRawStream} from 'pdf-lib';
import {challanPdf} from '../src/rental/challan-pdf';
async function textOf(bytes:Uint8Array){const pdf=await PDFDocument.load(bytes);let text='';for(const [,object] of pdf.context.enumerateIndirectObjects()){if(!(object instanceof PDFRawStream))continue;try{const stream=Buffer.from(decodePDFRawStream(object).decode()).toString('latin1');for(const m of stream.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g))text+=Buffer.from(m[1],'hex').toString('latin1')+'\n';}catch{}}return {text,pages:pdf.getPageCount()};}
test('challan prints one general note, phone, separate addresses and each stock type',async()=>{const shared={customer:'Customer',date:'2026-11-12',type:'DISPATCH',reference:'DC-TEST',address:'Registered GST address',delivery_site:'Manual delivery site',contact_phone:'9876543210',mobile:'1111111111',note:'Unique general note',quantity:2};const {text}=await textOf(await challanPdf([{...shared,item:'Pipe',stock_type:'Rent'},{...shared,item:'Clamp',stock_type:'New Rent'}],{name:'Jyoti Engineering'}));assert.equal(text.split('Unique general note').length-1,1);assert.match(text,/Notes/);assert.match(text,/To,\nCustomer\nRegistered GST address/);assert.match(text,/Site address:\nManual delivery site/);assert.doesNotMatch(text,/To Site|Delivery Site/);assert.match(text,/9876543210/);assert.doesNotMatch(text,/1111111111/);assert.match(text,/Pipe - Rent/);assert.match(text,/Clamp - New Rent/);});
test('multi-page challan still prints its general note only once',async()=>{const rows=Array.from({length:60},(_,i)=>({customer:'Customer',date:'2026-11-12',type:'DISPATCH',reference:'MULTI',item:'Scaffolding material '+i,quantity:1,note:'Only once across all pages',stock_type:'Rent'}));const {text,pages}=await textOf(await challanPdf(rows,{name:'Jyoti Engineering'}));assert.ok(pages>1);assert.equal(text.split('Only once across all pages').length-1,1);});

test('optional site address stays blank without falling back to the saved site',async()=>{
 for(const delivery_site of [undefined,'','   ']){
  const {text}=await textOf(await challanPdf([{customer:'Party',address:'GST registered address',site_name:'Saved ledger site',delivery_site,date:'2026-11-25',type:'DISPATCH',item:'Pipe',quantity:1}],{name:'Jyoti Engineering'}));
  assert.match(text,/To,\nParty\nGST registered address/);
  assert.match(text,/Site address:\nContact:/);
  assert.doesNotMatch(text,/Saved ledger site/);
 }
});
