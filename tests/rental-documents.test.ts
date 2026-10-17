import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {quotationAmounts,quotationPdf} from '../src/rental/quotation-pdf';
import {referenceRows} from '../src/rental/party-reference';
const snapshot={date:'2026-10-15',company:{name:'JYOTI ENGINEERING',gst_percent:18},customer:{name:'Sample customer',locking_days:60},deposit:200000,lines:[{name:'Prop Jack (2.0X3.0 Mtr)',quantity:500,rate:'1.80',monthly_total:'27000',material_value:'1570',material_total:'785000',weight:23}]};
test('quotation matches reference rental, GST, replacement value and weight calculations',()=>{
 const a=quotationAmounts(snapshot);
 assert.equal(a.daily.toFixed(2),'900.00');assert.equal(a.monthly.add(a.monthlyTax).toFixed(2),'31860.00');
 assert.equal(a.material.add(a.materialTax).toFixed(2),'926300.00');assert.equal(a.weight.toFixed(2),'11500.00');
});
test('quotation fits reference paper size and paginates long material lists',async()=>{
 const one=await PDFDocument.load(await quotationPdf({id:'sample',snapshot}));assert.equal(one.getPageCount(),1);
 const many=await PDFDocument.load(await quotationPdf({id:'sample',snapshot:{...snapshot,lines:Array.from({length:60},(_,i)=>({...snapshot.lines[0],name:'Long material description number '+i}))}}));
 assert.ok(many.getPageCount()>1);
});
test('party reference closing entry balances both sides without changing transaction totals',()=>{
 const rows=referenceRows({opening:'352239',debit:'234716',credit:'352239',closing:'234716',rows:[]},[],'party','2026-10-01');
 assert.equal(rows[0].debit,352239);assert.equal(rows.at(-2)?.credit,234716);
 assert.equal(rows.at(-1)?.debit,586955);assert.equal(rows.at(-1)?.credit,586955);
 const credit=referenceRows({opening:'-100',debit:'0',credit:'0',closing:'-100',rows:[]},[],'party','2026-10-01');
 assert.equal(credit.at(-2)?.debit,100);
});
