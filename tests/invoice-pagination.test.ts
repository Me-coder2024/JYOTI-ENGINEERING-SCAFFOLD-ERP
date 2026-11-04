import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {referenceInvoicePdf} from '../src/rental/invoice-reference';
test('twenty two-line items use two pages without reserving footer space on every page',async()=>{
 const lines=Array.from({length:20},(_,i)=>({name:'Scaffolding material '+i,formula:'(0+100)=100',hsn:'995457',start:'2026-08-01',end:'2026-08-31',days:31,quantity:100,rate:0.55,amount:1705}));
 const record={invoice_no:'LAYOUT-TEST',status:'DRAFT',generated_at:'2026-09-01',snapshot:{company:{name:'JYOTI ENGINEERING'},customer:{name:'Layout customer',address:'Site address'},lines,damages:[],rental_total:34100,subtotal:34100,gst_percent:18,gst_amount:6138,grand_total:40238},payments:[]};
 const doc=await PDFDocument.load(await referenceInvoicePdf(record));assert.equal(doc.getPageCount(),2);
});
