import test from 'node:test';
import assert from 'node:assert/strict';
import {timelines,rentalSegments,type Movement} from '../src/lib/engine';
import {groupChallans} from '../src/rental/challan-groups';
test('inward stock and rental rate allocations remain within their own site',()=>{
 const rows:Movement[]=[{id:'a',item_id:'i',date:'2026-01-01',type:'DISPATCH',quantity:10,rental_rate:'1',site_name:'A'},{id:'b',item_id:'i',date:'2026-01-02',type:'DISPATCH',quantity:10,rental_rate:'3',site_name:'B'},{id:'r',item_id:'i',date:'2026-01-03',type:'RETURN',quantity:4,site_name:'B'}];
 assert.equal(timelines(rows).allocations[0].lot_id,'b');
 assert.throws(()=>timelines([...rows,{id:'bad',item_id:'i',date:'2026-01-04',type:'RETURN',quantity:7,site_name:'B'}]),/only 6/);
 const segments=rentalSegments(rows,'2026-01-01','2026-01-04',[]);
 assert.equal(segments.reduce((n,s)=>n+Number(s.amount),0),118); // A:40, B:60+18
});
test('complete challans group batch lines and carefully match legacy references',()=>{
 const m={customer_id:'a',date:'2026-01-01',type:'DISPATCH',reference:'C1',site_name:''};
 const rows=[{...m,id:'1'},{...m,id:'2'},{...m,id:'3',customer_id:'b'},{...m,id:'4',type:'RETURN'},{...m,id:'5',date:'2026-01-02'},{...m,id:'6',reference:''},{...m,id:'7',reference:''},{...m,id:'8',challan_id:'batch'},{...m,id:'9',challan_id:'batch'}];
 assert.deepEqual(groupChallans(rows).map(g=>g.length),[2,1,1,1,1,1,2]);
});
