import {z} from 'zod';
import {transaction} from '@/lib/db';
import {AccessError} from '@/shared/access';
import {loadFormats} from './ledger-format-service';
import {challanPdf} from './challan-pdf';
export async function loadChallan(id:string){
 z.string().uuid().parse(id);
 return transaction(async db=>{
  const m=(await db.query('SELECT * FROM movements WHERE id=$1',[id])).rows[0];
  if(!m)throw new AccessError('Challan not found.',404);
  // A legacy reference is only shared within one customer/date/direction/site.
  // Blank references remain individual entries; modern batches retain their ID.
  const rows=(await db.query(`SELECT m.*,c.name customer,c.address,c.contact_person,c.mobile,i.name item FROM movements m JOIN customers c ON c.id=m.customer_id JOIN items i ON i.id=m.item_id WHERE m.customer_id=$1 AND (($2::uuid IS NOT NULL AND m.challan_id=$2) OR ($2::uuid IS NULL AND m.challan_id IS NULL AND (($4<>'' AND btrim(m.reference)=$4 AND m.date=$5 AND m.type=$6 AND m.site_name=$7) OR ($4='' AND m.id=$3)))) ORDER BY m.date,m.created_at,m.id`,[m.customer_id,m.challan_id,id,(m.reference||'').trim(),m.date,m.type,m.site_name||''])).rows;
  return {rows,company:(await db.query('SELECT * FROM company WHERE id=1')).rows[0]||{}};
 },true);
}
export async function challanExport(id:string){
 const {rows,company}=await loadChallan(id);
 return {bytes:await challanPdf(rows,company,(await loadFormats()).challan),type:'application/pdf',extension:'pdf'};
}
