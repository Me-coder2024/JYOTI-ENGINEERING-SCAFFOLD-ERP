import test from 'node:test';
import assert from 'node:assert/strict';
import { rentalSegments, totals, type Movement } from '../src/lib/engine';
const rates=[{effective_from:'2026-01-01',rate:'3'},{effective_from:'2026-06-05',rate:'4'}];
const d=(id:string,date:string,quantity:number,rate?:string,lock_until=date):Movement=>({id,item_id:'pipe',date,type:'DISPATCH',quantity,rental_rate:rate,lock_until});
const r=(id:string,date:string,quantity:number):Movement=>({id,item_id:'pipe',date,type:'RETURN',quantity});
const price=(ms:Movement[])=>rentalSegments(ms,'2026-06-01','2026-06-10',rates,'2026-06-10');
test('customer agreed rate is independent of catalog revisions',()=>{
 const rows=price([d('1','2026-06-01',10,'2.5')]);assert.equal(rows.length,1);assert.equal(rows[0].amount,'250.00');
});
test('same item with different dispatch rates stays in separate price groups',()=>{
 const rows=price([d('1','2026-06-01',10,'2'),d('2','2026-06-01',20,'3')]);
 assert.deepEqual(rows.map(x=>[x.quantity,x.rate,x.amount]),[[10,'2.0000','200.00'],[20,'3.0000','600.00']]);
});
test('FIFO return reduces the oldest agreed-rate group, never the newest price',()=>{
 const rows=price([d('1','2026-06-01',10,'2'),d('2','2026-06-02',20,'3'),r('3','2026-06-05',15)]);
 assert.equal(totals(rows.map(x=>x.amount!),[],'0').grand_total,'530.00');
 assert.equal(rows.find(x=>x.start==='2026-06-05')?.quantity,15);
});
test('early return bills each lot at its agreed rate until its own lock',()=>{
 const rows=price([d('1','2026-06-01',10,'2','2026-06-06'),d('2','2026-06-02',20,'3','2026-06-09'),r('3','2026-06-03',15)]);
 assert.equal(totals(rows.map(x=>x.amount!),[],'0').grand_total,'610.00');
});
test('legacy dispatches preserve historical catalog-rate behavior',()=>{
 const rows=price([d('1','2026-06-01',10)]);assert.deepEqual(rows.map(x=>x.amount),['120.00','240.00']);
});
test('mixed legacy and new agreed-rate dispatches both retain correct prices',()=>{
 const rows=price([d('1','2026-06-01',10),d('2','2026-06-01',5,'2')]);assert.equal(totals(rows.map(x=>x.amount!),[],'0').grand_total,'460.00');
});
test('zero is a valid agreed rate and is not replaced by the catalog rate',()=>{
 assert.equal(price([d('1','2026-06-01',10,'0')])[0].amount,'0.00');
});
test('groups preserve four-decimal rates and exact final money rounding',()=>{
 assert.equal(price([d('1','2026-06-01',3,'0.1234')])[0].amount,'3.70');
});
