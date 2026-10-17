import {quotationPdf} from '@/rental/quotation-pdf';
import {invoicePdf} from '@/rental/print-documents';
import {materialExport} from '@/rental/material-export';
import Decimal from 'decimal.js';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import ExcelJS from 'exceljs';
import { pool } from './db';
import { balanceAt, timelines, today } from './engine';
type Obj = Record<string, any>;
export async function makePdf(record:Obj,quotation=false) {
 return quotation?quotationPdf(record):invoicePdf(record);
}
export async function makeExcel(kind:string,customerId?:string) {
 const book=new ExcelJS.Workbook(),sheet=book.addWorksheet(kind==='ledger'?'Customer ledger':'Invoices');
 if(kind==='ledger') {
 return (await materialExport(new URLSearchParams({customer:customerId||'',start:'1900-01-01',end:today(),format:'xlsx'}))).bytes;
 } else if(kind==='invoices') {
  sheet.columns=[{header:'Invoice',key:'invoice_no',width:24},{header:'Customer',key:'name',width:28},{header:'From',key:'period_start',width:14},{header:'To',key:'period_end',width:14},{header:'Status',key:'status',width:12},{header:'Rental',key:'rental_total',width:18},{header:'Damage',key:'damage_total',width:18},{header:'GST',key:'gst_amount',width:18},{header:'Total',key:'grand_total',width:20}];
  const rows=(await pool.query('SELECT i.*,c.name FROM invoices i JOIN customers c ON c.id=i.customer_id ORDER BY generated_at DESC')).rows;
  rows.forEach(r=>sheet.addRow(r));
 }else throw new Error('Unknown export.');
 sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF173B36'}};sheet.views=[{state:'frozen',ySplit:1}];sheet.autoFilter={from:{row:1,column:1},to:{row:1,column:sheet.columnCount}};
 book.creator='Jyoti Rental Desk';book.created=new Date(today());
 return new Uint8Array(await book.xlsx.writeBuffer());
}
