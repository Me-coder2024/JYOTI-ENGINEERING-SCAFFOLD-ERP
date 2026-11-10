import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import Decimal from 'decimal.js';
import {transaction} from '@/lib/db';
import {AccessError,type User} from '@/shared/access';
import {postVoucher} from './accounting';

// The caller holds the accounting lock before locking an invoice. Both changes
// commit together; the unique source_invoice_id also protects repeated requests.
export async function postInvoice(db:PoolClient,user:User,invoice:Record<string,any>){
 const existing=(await db.query('SELECT id FROM rental_acc_vouchers WHERE source_invoice_id=$1',[invoice.id])).rows[0];
 if(existing)return {id:existing.id,repeated:true};
 const manual=(await db.query(`SELECT voucher_no FROM rental_acc_vouchers v WHERE v.type='Sales' AND v.source_invoice_id IS NULL AND v.reference=$1 AND NOT EXISTS(SELECT 1 FROM rental_acc_vouchers r WHERE r.reverses_id=v.id)`,[invoice.invoice_no])).rows[0];
 if(manual)throw new AccessError('Review manual voucher '+manual.voucher_no+' before posting '+invoice.invoice_no+' again.',409);
 if(new Decimal(invoice.grand_total).isZero())return {zero:true};
 const party=(await db.query('SELECT id FROM rental_acc_ledgers WHERE customer_id=$1 AND is_active',[invoice.customer_id])).rows[0];
 if(!party)throw new AccessError('Activate the customer account before finalizing this invoice.');
 async function account(name:string,group:string){
  await db.query(`INSERT INTO rental_acc_ledgers(id,name,group_name,created_by) VALUES($1,$2,$3,$4) ON CONFLICT(name) DO NOTHING`,[randomUUID(),name,group,user.id]);
  const row=(await db.query('SELECT * FROM rental_acc_ledgers WHERE name=$1',[name])).rows[0];
  if(!row.is_active||row.group_name!==group)throw new AccessError('Check the group and active status of '+name+'.');
  return row.id as string;
 }
 const lines=[{ledger_id:party.id,debit:Number(invoice.grand_total),credit:0}];
 if(Number(invoice.subtotal)>0)lines.push({ledger_id:await account('Rental invoice sales','Sales Accounts'),debit:0,credit:Number(invoice.subtotal)});
 if(Number(invoice.gst_amount)>0)lines.push({ledger_id:await account('Rental invoice GST payable','Duties & Taxes'),debit:0,credit:Number(invoice.gst_amount)});
 return postVoucher(user,{id:randomUUID(),type:'Sales',date:new Date(invoice.finalized_at).toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'}),narration:'Rental invoice '+invoice.invoice_no,reference:invoice.invoice_no,source_invoice_id:invoice.id,lines},db);
}

export async function reconcileInvoices(user:User){
 if(user.role!=='OWNER')throw new AccessError('Only the owner can reconcile invoice postings.',403);
 return transaction(async db=>{
  await db.query('SELECT pg_advisory_xact_lock(914715)');
  const invoices=(await db.query(`SELECT i.* FROM invoices i WHERE status='FINAL' AND grand_total>0 AND NOT EXISTS(SELECT 1 FROM rental_acc_vouchers v WHERE v.source_invoice_id=i.id) ORDER BY finalized_at FOR UPDATE`)).rows;
  // Do not silently duplicate an older manually entered charge.
  for(const i of invoices){
   const possible=(await db.query(`SELECT voucher_no FROM rental_acc_vouchers WHERE type='Sales' AND source_invoice_id IS NULL AND reference=$1 AND NOT EXISTS(SELECT 1 FROM rental_acc_vouchers r WHERE r.reverses_id=rental_acc_vouchers.id)`,[i.invoice_no])).rows;
   if(possible.length)throw new AccessError('Review manual voucher '+possible[0].voucher_no+' for '+i.invoice_no+' before reconciliation; no changes were saved.',409);
   await postInvoice(db,user,i);
  }
  return {posted:invoices.length};
 });
}
