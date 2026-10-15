import {z} from 'zod';
import {transaction} from '@/lib/db';
import {timelines,addDays,daysBetween,today,day,type Movement} from '@/lib/engine';
import {AccessError,type User} from '@/shared/access';
const schema=z.object({
 id:z.string().uuid(),revision:z.number().int().nonnegative(),action:z.enum(['EDIT','DELETE']),
 reason:z.string().trim().min(3).max(2000),
 date:z.string().refine(s=>{try{day(s);return true;}catch{return false;}}).optional(),
 quantity:z.coerce.number().int().positive().max(10000000).optional(),
 damaged_quantity:z.coerce.number().int().nonnegative().optional(),
 rental_rate:z.coerce.number().min(0).max(99999999).refine(n=>Math.abs(n*10000-Math.round(n*10000))<0.00001).nullable().optional(),
 reference:z.string().trim().max(80).optional(),note:z.string().trim().max(10000).optional()
});
export async function correctMovement(user:User,input:unknown){
 if(user.role!=='OWNER')throw new AccessError('Only the owner may edit or delete past movements.',403);
 const d=schema.parse(input);
 return transaction(async db=>{
  await db.query('SELECT pg_advisory_xact_lock(914712)');
  const old=(await db.query('SELECT * FROM movements WHERE id=$1 FOR UPDATE',[d.id])).rows[0];
  if(!old)throw new AccessError('Movement no longer exists. Refresh the list.',409);
  if(old.revision!==d.revision)throw new AccessError('Another correction changed this entry. Refresh before editing.',409);
  let next:any=null;
  if(d.action==='EDIT'){
   if(!d.date||!d.quantity||d.damaged_quantity===undefined)throw new AccessError('Date and quantities are required.');
   if(d.date>today())throw new AccessError('Future stock movements are not allowed.');
   if(d.damaged_quantity>d.quantity||(old.type==='DISPATCH'&&d.damaged_quantity))throw new AccessError('Damaged quantity must be part of a return.');
   if(d.damaged_quantity&&Number(old.damage_price)<=0)throw new AccessError('This entry has no saved damage price. Review the item before recording damage.');
   next={...old,date:d.date,quantity:d.quantity,damaged_quantity:d.damaged_quantity,reference:d.reference??old.reference,note:d.note??old.note,revision:old.revision+1};
   if(old.type==='DISPATCH'){
    next.rental_rate=d.rental_rate===undefined?old.rental_rate:d.rental_rate;
    next.lock_until=addDays(d.date,daysBetween(old.date,old.lock_until));
   }
  }
  const earliest=next&&next.date<old.date?next.date:old.date;
  const locked=(await db.query("SELECT invoice_no FROM invoices WHERE customer_id=$1 AND status='FINAL' AND period_end >= $2 LIMIT 1",[old.customer_id,earliest])).rows[0];
  if(locked)throw new AccessError('This correction affects finalized invoice '+locked.invoice_no+'. Use an accounting adjustment; the original movement is locked.');
  const rows=(await db.query('SELECT * FROM movements WHERE customer_id=$1 AND item_id=$2 ORDER BY date,created_at,id',[old.customer_id,old.item_id])).rows;
  const revised=rows.filter(r=>r.id!==old.id);
  if(next)revised.push(next);
  const built=timelines(revised.map(r=>({...r,created_at:r.created_at.toISOString()})) as Movement[]);
  await db.query('DELETE FROM return_allocations WHERE return_id IN (SELECT id FROM movements WHERE customer_id=$1 AND item_id=$2)',[old.customer_id,old.item_id]);
  if(next){
   await db.query('UPDATE movements SET date=$2,quantity=$3,damaged_quantity=$4,rental_rate=$5,lock_until=$6,reference=$7,note=$8,revision=$9 WHERE id=$1',[old.id,next.date,next.quantity,next.damaged_quantity,next.rental_rate,next.lock_until,next.reference,next.note,next.revision]);
   if(old.type==='DISPATCH')await db.query('UPDATE dispatch_lots SET original_quantity=$2,dispatch_date=$3,lock_until=$4 WHERE id=$1',[old.id,next.quantity,next.date,next.lock_until]);
  }else{
   await db.query('DELETE FROM dispatch_lots WHERE id=$1',[old.id]);
   await db.query('DELETE FROM movements WHERE id=$1',[old.id]);
  }
  for(const a of built.allocations)await db.query('INSERT INTO return_allocations(return_id,lot_id,quantity,return_date,billing_date) VALUES($1,$2,$3,$4,$5)',[a.return_id,a.lot_id,a.quantity,a.return_date,a.billing_date]);
  await db.query('INSERT INTO rental_movement_revisions(movement_id,user_id,action,reason,before_record,after_record) VALUES($1,$2,$3,$4,$5,$6)',[old.id,user.id,d.action,d.reason,JSON.stringify(old),next?JSON.stringify(next):null]);
  await db.query('INSERT INTO erp_audit(user_id,action,entity_id,details) VALUES($1,$2,$3,$4)',[user.id,'RENTAL_MOVEMENT_'+d.action,old.id,JSON.stringify({reason:d.reason,before:old,after:next})]);
  return {ok:true};
 });
}
