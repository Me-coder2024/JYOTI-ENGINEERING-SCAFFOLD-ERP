import {z} from 'zod';
import {transaction} from '@/lib/db';
import {AccessError} from '@/shared/access';
import {renderLedger} from './ledger-render';
import {loadFormats} from './ledger-format-service';
export async function challanExport(id:string){
 z.string().uuid().parse(id);
 const rows=await transaction(async db=>{
  const m=(await db.query('SELECT * FROM movements WHERE id=$1',[id])).rows[0];
  if(!m)throw new AccessError('Challan not found.',404);
  // Legacy rows have no batch identity: never combine unrelated historical entries.
  return (await db.query('SELECT m.*,c.name customer,c.address,i.name item FROM movements m JOIN customers c ON c.id=m.customer_id JOIN items i ON i.id=m.item_id WHERE m.customer_id=$1 AND (($2::uuid IS NOT NULL AND m.challan_id=$2) OR ($2::uuid IS NULL AND m.id=$3)) ORDER BY m.date,m.created_at,m.id',[m.customer_id,m.challan_id,id])).rows;
 },true);
 const m=rows[0],settings=(await loadFormats()).material;
 return renderLedger({party:m.customer,address:[m.address,'Challan: '+m.reference,'Vehicle: '+(m.vehicle_no||'Not specified')].filter(Boolean).join(' | '),start:m.date,end:rows.at(-1).date,rows:rows.map(r=>({values:{Date:r.date,Reference:r.reference,Particulars:r.item,'Issu Qty':r.type==='DISPATCH'?r.quantity:0,'Rcpt Qty':r.type==='RETURN'?r.quantity:0,Notes:r.note}}))},{...settings,title:m.type==='DISPATCH'?'DELIVERY CHALLAN':'RETURN CHALLAN',columns:['Date','Reference','Particulars','Issu Qty','Rcpt Qty','Notes']},'pdf');
}
