import test from 'node:test';
import assert from 'node:assert/strict';
import {partyStatement} from '../src/rental/party-ledger';
import {defaultFormat,validateFormat} from '../src/rental/ledger-formats';
test('party ledger derives opening, chronological entries, reversal and closing from posted lines',()=>{
 const v=(id:string,date:string,created_at:string,debit:number,credit:number)=>({id,date,created_at,voucher_no:id,type:'Journal',narration:id,lines:[{ledger_id:'party',debit,credit}]});
 const entries=[v('4','2026-10-15','2026-10-15T09:00:00.020Z',0,8000),v('1','2026-09-30','2026-09-30T09:00:00Z',20000,0),v('3','2026-10-15','2026-10-15T09:00:00.010Z',8000,0),v('2','2026-10-01','2026-10-01T09:00:00Z',0,8000),v('5','2026-10-16','2026-10-16T09:00:00Z',1000,0)];
 const report=partyStatement(entries,'party','2026-10-01','2026-10-15');
 assert.equal(report.opening,'20000.00');assert.deepEqual(report.rows.map(r=>r.id),['2','3','4']);
 assert.equal(report.debit,'8000.00');assert.equal(report.credit,'16000.00');assert.equal(report.closing,'12000.00');
 const databaseRows=entries.map(v=>({...v,created_at:new Date(v.created_at)}));
 assert.deepEqual(partyStatement(databaseRows,'party','2026-10-01','2026-10-15'),report);
});
test('format controls permit reordering but preserve financial and stock columns',()=>{
 const format=defaultFormat('material');
 assert.equal(validateFormat('material',{...format,columns:[...format.columns].reverse()}).columns[0],'Pend.Qty');
 assert.throws(()=>validateFormat('material',{...format,columns:format.columns.filter(c=>c!=='Pend.Qty')}));
 assert.throws(()=>validateFormat('party',{...defaultFormat('party'),font_size:40}));
 assert.throws(()=>validateFormat('party',{...defaultFormat('party'),heading:''}));
});
