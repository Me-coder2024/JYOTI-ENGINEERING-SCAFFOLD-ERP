import {z} from 'zod';
import {transaction} from '@/lib/db';
import {AccessError,demand,type Module,type User} from '@/shared/access';

export async function deleteRecord(user:User,input:unknown){

 const d=z.object({kind:z.enum(['invoice','quotation','customer','item','ledger']),id:z.string().uuid(),reason:z.string().trim().min(3).max(2000)}).parse(input);
 demand(user,({invoice:'invoices',quotation:'quotations',customer:'customers',item:'inventory',ledger:'accounts'} as Record<string,Module>)[d.kind],'delete');
 const table={invoice:'invoices',quotation:'quotations',customer:'customers',item:'items',ledger:'rental_acc_ledgers'}[d.kind];
 return transaction(async db=>{
  await db.query('SELECT pg_advisory_xact_lock(914715)');
  await db.query('SELECT pg_advisory_xact_lock(914712)');
  const old=(await db.query(`SELECT * FROM ${table} WHERE id=$1 FOR UPDATE`,[d.id])).rows[0];
  if(!old)return {deleted:true,repeated:true};
  if(d.kind==='invoice'&&old.status!=='DRAFT')throw new AccessError('Final invoices cannot be deleted. Cancel their accounting voucher with a recorded reversal.',409);
  if(d.kind==='ledger'&&old.customer_id)throw new AccessError('Delete the unused customer profile instead of its linked account.',409);
  if(d.kind==='ledger'||d.kind==='customer'){
   const ledgers=d.kind==='ledger'?[{id:d.id}]:(await db.query('SELECT id FROM rental_acc_ledgers WHERE customer_id=$1',[d.id])).rows;
   for(const l of ledgers){
    if((await db.query('SELECT 1 FROM rental_acc_vouchers WHERE lines @> $1::jsonb LIMIT 1',[JSON.stringify([{ledger_id:l.id}])])).rowCount)throw new AccessError('This account has posted transactions. Keep its history and archive it instead.',409);
   }
   if(d.kind==='customer')await db.query('DELETE FROM rental_acc_ledgers WHERE customer_id=$1',[d.id]);
  }
  if(d.kind==='item'){
   if((await db.query(`SELECT 1 FROM invoices WHERE snapshot->'lines' @> $1::jsonb UNION ALL SELECT 1 FROM quotations WHERE snapshot->'lines' @> $1::jsonb LIMIT 1`,[JSON.stringify([{item_id:d.id}])])).rowCount)throw new AccessError('This item is used by an invoice or quotation. Mark it inactive instead.',409);
   old.rates=(await db.query('SELECT * FROM rates WHERE item_id=$1',[d.id])).rows;
   await db.query('DELETE FROM rates WHERE item_id=$1',[d.id]);
  }
  await db.query('INSERT INTO erp_audit(user_id,action,entity_id,details) VALUES($1,$2,$3,$4)',[user.id,'RENTAL_'+d.kind.toUpperCase()+'_DELETED',d.id,JSON.stringify({reason:d.reason,record:old})]);
  try{await db.query(`DELETE FROM ${table} WHERE id=$1`,[d.id]);}
  catch(e){if((e as {code?:string}).code==='23503')throw new AccessError('This record is used by existing transactions and cannot be deleted. Preserve the history.',409);throw e;}
  return {deleted:true};
 });
}
