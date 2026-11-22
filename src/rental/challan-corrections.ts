import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {transaction} from '@/lib/db';
import {AccessError,can,type User} from '@/shared/access';
import {addDays,daysBetween,day,today,timelines,type Movement} from '@/lib/engine';
import {challanKey} from './challan-groups';
const schema=z.object({id:z.string().uuid(),action:z.enum(['EDIT','DELETE']),reason:z.string().trim().min(3).max(2000),versions:z.array(z.object({id:z.string().uuid(),revision:z.number().int()})).min(1),date:z.string().refine(v=>{try{day(v);return true;}catch{return false;}}).optional(),note:z.string().trim().max(10000).default(''),vehicle_no:z.string().trim().max(40).default(''),contact_phone:z.string().trim().max(40).default(''),delivery_site:z.string().trim().max(2000).default(''),lines:z.array(z.object({id:z.string().uuid().optional(),item_id:z.string().uuid(),quantity:z.coerce.number().int().positive().max(10000000),damaged_quantity:z.coerce.number().int().nonnegative().default(0),rental_rate:z.coerce.number().min(0).max(99999999).nullable().optional(),stock_type:z.enum(['Rent','New Rent']).default('Rent')})).max(100).optional()});
export async function correctChallan(user:User,input:unknown){
 const d=schema.parse(input);
 if(!can(user,'challans',d.action==='DELETE'?'delete':'edit'))throw new AccessError('Challan permission required.',403);
 return transaction(async db=>{
  await db.query('SELECT pg_advisory_xact_lock(914712)');
  const first=(await db.query('SELECT * FROM movements WHERE id=$1',[d.id])).rows[0];
  if(!first)throw new AccessError('Challan no longer exists. Refresh the list.',409);
  const all=(await db.query('SELECT * FROM movements WHERE customer_id=$1 ORDER BY date,created_at,id FOR UPDATE',[first.customer_id])).rows;
  const old=all.filter(m=>challanKey(m)===challanKey(first)),ids=new Set(old.map(m=>m.id));
  if(old.length!==d.versions.length||old.some(m=>!d.versions.some(v=>v.id===m.id&&v.revision===m.revision)))throw new AccessError('This challan has changed. Reopen it before saving.',409);
  if(d.action==='EDIT'&&(!d.date||d.date>today()||!d.lines?.length))throw new AccessError('Choose a valid date and at least one item.');
  const earliest=d.date&&d.date<first.date?d.date:first.date;
  const locked=(await db.query("SELECT invoice_no FROM invoices WHERE customer_id=$1 AND status='FINAL' AND period_end >= $2 AND (snapshot->>'billing_scope'='company' OR COALESCE(snapshot->>'site_name','')=$3) LIMIT 1",[first.customer_id,earliest,first.site_name||''])).rows[0];
  if(locked)throw new AccessError('This challan affects finalized invoice '+locked.invoice_no+'. Use an accounting adjustment.',409);
  const next:any[]=[],batch=first.challan_id||randomUUID();
  if(d.action==='EDIT'){
   if(new Set(d.lines!.map(l=>l.item_id)).size!==d.lines!.length)throw new AccessError('Choose each item only once.');
   const customer=(await db.query('SELECT locking_days FROM customers WHERE id=$1',[first.customer_id])).rows[0];
   for(const line of d.lines!){
    const previous=line.id?old.find(m=>m.id===line.id):undefined;
    if(line.id&&!previous)throw new AccessError('An item does not belong to this challan.');
    if(previous&&previous.item_id!==line.item_id)throw new AccessError('Remove the old item and add a new line to change material.');
    const item=(await db.query('SELECT * FROM items WHERE id=$1',[line.item_id])).rows[0];
    if(!item||(!previous&&first.type==='DISPATCH'&&!item.active))throw new AccessError('Choose an active material.');
    if(line.damaged_quantity>line.quantity||(first.type==='DISPATCH'&&line.damaged_quantity))throw new AccessError('Damaged pieces must be part of a return.');
    if(line.damaged_quantity&&Number(previous?.damage_price??item.material_value)<=0)throw new AccessError('Set the material replacement price before recording damage.');
    if(first.type==='DISPATCH'&&!previous&&line.rental_rate==null)throw new AccessError('Enter a rental rate for each added material.');
    next.push({...first,...previous,...line,id:previous?.id||randomUUID(),date:d.date,reference:first.reference,challan_id:batch,revision:(previous?.revision??-1)+1,note:d.note,vehicle_no:d.vehicle_no,contact_phone:d.contact_phone,delivery_site:d.delivery_site,damage_price:previous?.damage_price??item.material_value,rental_rate:first.type==='DISPATCH'?(line.rental_rate??previous?.rental_rate??null):null,lock_until:first.type==='DISPATCH'?addDays(d.date!,previous?daysBetween(previous.date,previous.lock_until):customer.locking_days):null,created_at:previous?.created_at||new Date()});
   }
  }
  const affected=[...new Set([...old,...next].map(m=>m.item_id))],revised=[...all.filter(m=>!ids.has(m.id)),...next];
  const allocations=[];
  for(const item of affected){try{allocations.push(...timelines(revised.filter(m=>m.item_id===item).map(m=>({...m,created_at:m.created_at.toISOString()})) as Movement[]).allocations);}catch(e){throw new AccessError('This change would invalidate a later return: '+(e as Error).message,409);}}
  await db.query('DELETE FROM return_allocations WHERE return_id IN (SELECT id FROM movements WHERE customer_id=$1 AND item_id=ANY($2::uuid[]))',[first.customer_id,affected]);
  const removed=old.filter(m=>!next.some(n=>n.id===m.id)).map(m=>m.id);
  await db.query('DELETE FROM dispatch_lots WHERE id=ANY($1::uuid[])',[removed]);
  await db.query('DELETE FROM movements WHERE id=ANY($1::uuid[])',[removed]);
  for(const m of next){
   await db.query(`INSERT INTO movements(id,customer_id,item_id,date,type,quantity,lock_until,damaged_quantity,damage_price,note,rental_rate,reference,challan_id,vehicle_no,site_name,contact_phone,delivery_site,stock_type,revision,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) ON CONFLICT(id) DO UPDATE SET date=$4,quantity=$6,lock_until=$7,damaged_quantity=$8,note=$10,rental_rate=$11,challan_id=$13,vehicle_no=$14,contact_phone=$16,delivery_site=$17,stock_type=$18,revision=$19`,[m.id,m.customer_id,m.item_id,m.date,m.type,m.quantity,m.lock_until,m.damaged_quantity,m.damage_price,m.note,m.rental_rate,m.reference,m.challan_id,m.vehicle_no,m.site_name,m.contact_phone,m.delivery_site,m.stock_type,m.revision,m.created_at]);
   if(m.type==='DISPATCH')await db.query('INSERT INTO dispatch_lots(id,customer_id,item_id,original_quantity,dispatch_date,lock_until) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET original_quantity=$4,dispatch_date=$5,lock_until=$6',[m.id,m.customer_id,m.item_id,m.quantity,m.date,m.lock_until]);
  }
  for(const a of allocations)await db.query('INSERT INTO return_allocations(return_id,lot_id,quantity,return_date,billing_date) VALUES($1,$2,$3,$4,$5)',[a.return_id,a.lot_id,a.quantity,a.return_date,a.billing_date]);
  for(const m of old)await db.query('INSERT INTO rental_movement_revisions(movement_id,user_id,action,reason,before_record,after_record) VALUES($1,$2,$3,$4,$5,$6)',[m.id,user.id,next.some(n=>n.id===m.id)?'EDIT':'DELETE',d.reason,JSON.stringify(m),JSON.stringify(next.find(n=>n.id===m.id)||null)]);
  await db.query('INSERT INTO erp_audit(user_id,action,entity_id,details) VALUES($1,$2,$3,$4)',[user.id,'CHALLAN_'+d.action,first.id,JSON.stringify({reason:d.reason,before:old,after:next})]);
  return {ok:true,reference:first.reference};
 });
}
