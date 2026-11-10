import {z} from 'zod';
import {transaction} from '@/lib/db';
import {AccessError} from '@/shared/access';
import {challanPdf} from './challan-pdf';
export async function challanExport(id:string){
 z.string().uuid().parse(id);
 const {rows,company}=await transaction(async db=>{
  const m=(await db.query('SELECT * FROM movements WHERE id=$1',[id])).rows[0];
  if(!m)throw new AccessError('Challan not found.',404);
  // Legacy rows have no batch identity: never combine unrelated historical entries.
  const rows=(await db.query('SELECT m.*,c.name customer,c.address,c.contact_person,c.mobile,i.name item FROM movements m JOIN customers c ON c.id=m.customer_id JOIN items i ON i.id=m.item_id WHERE m.customer_id=$1 AND (($2::uuid IS NOT NULL AND m.challan_id=$2) OR ($2::uuid IS NULL AND m.id=$3)) ORDER BY m.date,m.created_at,m.id',[m.customer_id,m.challan_id,id])).rows;
  return {rows,company:(await db.query('SELECT * FROM company WHERE id=1')).rows[0]||{}};
 },true);
 return {bytes:await challanPdf(rows,company),type:'application/pdf',extension:'pdf'};
}
