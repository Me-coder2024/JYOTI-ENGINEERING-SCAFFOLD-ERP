import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {PDFDocument} from 'pdf-lib';
import {invoiceExcel,referenceInvoicePdf} from '../src/rental/invoice-reference';
const row={name:'Scaffolding pipe',hsn:'995457',start:'2026-09-01',end:'2026-09-30',days:30,quantity:100,rate:'1.2345',amount:'3703.50'};
const invoice={invoice_no:'TEST-1',status:'DRAFT',generated_at:'2026-10-01',snapshot:{company:{name:'JYOTI ENGINEERING'},customer:{name:'Example customer',address:'Sample address'},period_start:row.start,period_end:row.end,lines:[row],damages:[],rental_total:'3703.50',damage_total:'0',subtotal:'3703.50',gst_percent:18,gst_amount:'666.63',grand_total:'4370.13',document_details:{tax_mode:'CGST_SGST'}},payments:[{date:'2026-10-02',voucher_no:'RV-1',total:'1000'}]};
test('invoice Excel preserves rates, billing periods and allocated payments',async()=>{
 const b=new ExcelJS.Workbook();await b.xlsx.load(Buffer.from(await invoiceExcel(invoice)) as any);
 const rows=b.getWorksheet('Invoice')!.getSheetValues() as any[];
 const material=rows.find(r=>r?.[1]==='Scaffolding pipe');assert.equal(material[7],1.2345);assert.equal(material[5],30);assert.equal(material[9],3703.5);
 assert.equal(rows.find(r=>r?.[1]==='Outstanding')[9],3370.13);
 assert.equal(b.getWorksheet('Payment history')!.getRow(2).getCell(2).value,'RV-1');
});
test('reference invoice generates A4 and paginates rental history without changing input',async()=>{
 const before=JSON.stringify(invoice);const pdf=await PDFDocument.load(await referenceInvoicePdf(invoice));assert.equal(pdf.getPageCount(),1);assert.equal(Math.round(pdf.getPage(0).getWidth()),595);assert.equal(JSON.stringify(invoice),before);
 const long=await PDFDocument.load(await referenceInvoicePdf({...invoice,snapshot:{...invoice.snapshot,lines:Array.from({length:80},()=>row)}}));assert.ok(long.getPageCount()>3);
});
