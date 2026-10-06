import {validGstin} from '@/rental/gst';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { pool, transaction } from './db';
import { addDays, balanceAt, damageAmount, day, money, rentalSegments, timelines, today, totals, type Movement } from './engine';

const text = z.string().trim().max(10000);
const date = z.string().refine(v => { try { day(v); return true; } catch { return false; } }, 'Enter a valid date');
const amount = z.coerce.number().min(0).max(999999999);
const uuid = z.string().uuid();
const customerSchema = z.object({ id: uuid.optional(), name: text.min(1), address: text.default(''), gst_no: text.transform(v=>v.trim().toUpperCase()).refine(v=>!v||validGstin(v),'Enter a valid GSTIN including its check digit.').default(''), state_code: text.default('24'), contact_person: text.default(''), mobile: text.default(''), email: z.union([z.email(),z.literal('')]).default(''), locking_days: z.coerce.number().int().min(0).max(3650), deposit: amount.default(0), mailing_name: text.max(2000).optional(), country: text.max(2000).optional(), place_of_supply: text.max(2000).optional(), gst_registration: z.enum(['Unknown','Regular','Composition','Unregistered/Consumer']).optional() });
const itemSchema = z.object({ id: uuid.optional(), name: text.min(1), hsn: text.default('995457'), category: text.default('Scaffolding'), material_value: amount, weight: amount.default(0), active: z.boolean().default(true), rate: amount.optional(), effective_from: date.optional() });
const movementSchema = z.object({ customer_id: uuid, date, type: z.enum(['DISPATCH','RETURN']), note: text.default(''), reference: text.max(80).default(''), lines: z.array(z.object({ item_id: uuid, quantity: z.coerce.number().int().positive().max(10000000), rental_rate: z.number().min(0).max(99999999).refine(v=>Math.abs(v*10000-Math.round(v*10000))<0.00001,'Use up to four decimal places.').optional(), damaged_quantity: z.coerce.number().int().min(0).default(0) })).min(1).max(100) });
async function audit(db: PoolClient, action: string, id: string, details: unknown) { await db.query('INSERT INTO audit_log(action,entity_id,details) VALUES($1,$2,$3)',[action,id,JSON.stringify(details)]); }
export async function state() {
 const results = await Promise.all([
 pool.query('SELECT * FROM company WHERE id=1'), pool.query("SELECT c.*, l.party_details->>'mailing_name' AS mailing_name,l.party_details->>'country' AS country,l.party_details->>'place_of_supply' AS place_of_supply,l.party_details->>'gst_registration' AS gst_registration FROM customers c LEFT JOIN rental_acc_ledgers l ON l.customer_id=c.id ORDER BY c.name"), pool.query('SELECT * FROM items ORDER BY name'), pool.query('SELECT * FROM rates ORDER BY effective_from'), pool.query('SELECT * FROM movements ORDER BY date,created_at,id'), pool.query('SELECT id,invoice_no,customer_id,period_start,period_end,status,grand_total,damage_total,generated_at FROM invoices ORDER BY generated_at DESC'), pool.query('SELECT * FROM quotations ORDER BY created_at DESC')]);
 const [company, customers, items, rates, movements, invoices, quotations] = results.map(r => r.rows);
 const balances = [];
 for (const c of customers) for (const i of items) {
   const ms = movements.filter(m => m.customer_id === c.id && m.item_id === i.id).map(m => ({...m,created_at:m.created_at.toISOString()}));
   if (!ms.length) continue;
   const t = timelines(ms);
   balances.push({ customer_id:c.id,item_id:i.id, physical:balanceAt(t.physical,today()),billable:balanceAt(t.billable,today()),pending:t.allocations.filter(a => a.return_date<=today() && a.billing_date>today()),last_movement:ms.at(-1).date });
 }
 return { company:company[0],customers,items,rates,movements,invoices,quotations,balances,today:today() };
}
export async function saveCustomer(input: unknown) {
 const d = customerSchema.parse(input), id=d.id||randomUUID();
 if(d.gst_no)d.state_code=d.gst_no.slice(0,2);
 return transaction(async db => {
 await db.query('SELECT pg_advisory_xact_lock(914715)');
 const previous=(await db.query('SELECT party_details FROM rental_acc_ledgers WHERE customer_id=$1',[id])).rows[0]?.party_details||{};
 await db.query(`INSERT INTO customers(id,name,address,gst_no,state_code,contact_person,mobile,email,locking_days,deposit) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(id) DO UPDATE SET name=$2,address=$3,gst_no=$4,state_code=$5,contact_person=$6,mobile=$7,email=$8,locking_days=$9,deposit=$10`,[id,d.name,d.address,d.gst_no,d.state_code,d.contact_person,d.mobile,d.email,d.locking_days,d.deposit]); await db.query('UPDATE rental_acc_ledgers SET party_details=$2 WHERE customer_id=$1',[id,JSON.stringify({...previous,mailing_name:d.mailing_name?.trim()||d.name,address:d.address,gstin:d.gst_no,state:d.state_code,country:d.country??previous.country??'India',place_of_supply:d.place_of_supply??previous.place_of_supply??'',gst_registration:d.gst_registration??previous.gst_registration??'Unknown'})]); await audit(db,'CUSTOMER_SAVE',id,d); return {id}; });
}
export async function saveItem(input: unknown) {
 const d=itemSchema.parse(input),id=d.id||randomUUID();
 return transaction(async db => {
   await db.query('SELECT pg_advisory_xact_lock(914712)');
   await db.query(`INSERT INTO items(id,name,hsn,category,material_value,weight,active) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET name=$2,hsn=$3,category=$4,material_value=$5,weight=$6,active=$7`,[id,d.name,d.hsn,d.category,d.material_value,d.weight,d.active]);
   if(d.rate!==undefined) {
     if(!d.effective_from) throw new Error('Choose an effective date for the new rate.');
     const locked=await db.query(`SELECT invoice_no FROM invoices WHERE status='FINAL' AND period_end >= $1 AND snapshot->'lines' @> $2::jsonb LIMIT 1`,[d.effective_from,JSON.stringify([{item_id:id}])]);
     if(locked.rows.length) throw new Error(`This rate affects finalized invoice ${locked.rows[0].invoice_no}. Use a later effective date or a credit/debit note.`);
     await db.query('INSERT INTO rates(id,item_id,effective_from,rate) VALUES($1,$2,$3,$4)',[randomUUID(),id,d.effective_from,d.rate]);
   }
   await audit(db,'ITEM_SAVE',id,d);return {id};
 });
}
async function checkFinal(db: PoolClient, customerId: string, start: string) {
 const locked=await db.query(`SELECT invoice_no FROM invoices WHERE customer_id=$1 AND status='FINAL' AND period_end >= $2 LIMIT 1`,[customerId,start]);
 if(locked.rows.length) throw new Error(`This change affects invoice ${locked.rows[0].invoice_no}, already finalized — generate a credit/debit note instead. No change was saved.`);
}
export async function saveMovement(input: unknown, preview=false) {
 const d=movementSchema.parse(input);
 if(d.date>today()) throw new Error('Future stock movements are not allowed.');
 if(new Set(d.lines.map(l=>l.item_id)).size!==d.lines.length) throw new Error('Choose each item only once per entry.');
 return transaction(async db => {
   await db.query('SELECT pg_advisory_xact_lock(914712)');
   const c=(await db.query('SELECT * FROM customers WHERE id=$1 FOR UPDATE',[d.customer_id])).rows[0];
   if(!c) throw new Error('Customer not found.');
   await checkFinal(db,c.id,d.date);
   const previews=[];
   for(const line of d.lines) {
     const item=(await db.query('SELECT * FROM items WHERE id=$1',[line.item_id])).rows[0];
     if(!item || (d.type==='DISPATCH'&&!item.active)) throw new Error('Choose an active item for dispatch.');
     if(line.damaged_quantity>line.quantity || (d.type==='DISPATCH'&&line.damaged_quantity)) throw new Error('Damaged quantity must be part of the returned quantity.');
     if(line.damaged_quantity && Number(item.material_value)<=0) throw new Error(`Set the original price for ${item.name} before recording damage.`);
     const ms=(await db.query('SELECT * FROM movements WHERE customer_id=$1 AND item_id=$2 ORDER BY date,created_at,id',[c.id,item.id])).rows.map(m=>({...m,created_at:m.created_at.toISOString()}));
     const id=randomUUID();
     let rentalRate:string|null=null;
     if(d.type==='DISPATCH') {
       const standard=(await db.query('SELECT rate FROM rates WHERE item_id=$1 AND effective_from<=$2 ORDER BY effective_from DESC LIMIT 1',[item.id,d.date])).rows[0]?.rate;
       if(line.rental_rate===undefined && standard===undefined) throw new Error(`Enter an agreed rental rate for ${item.name}; no standard rate is set on ${d.date}.`);
       rentalRate=Number(line.rental_rate??standard).toFixed(4);
     } else if(line.rental_rate!==undefined) throw new Error('Return rates come from the original dispatch and cannot be changed.');
     const m: Movement={id,item_id:item.id,date:d.date,type:d.type,quantity:line.quantity,rental_rate:rentalRate,lock_until:d.type==='DISPATCH'?addDays(d.date,c.locking_days):null,created_at:new Date().toISOString(),damaged_quantity:line.damaged_quantity,damage_price:item.material_value,note:d.note};
     const old=timelines(ms), built=timelines([...ms,m]);
     const deferred=built.allocations.filter(a=>a.return_id===id && a.billing_date>d.date);
     previews.push({item_id:item.id,name:item.name,before:balanceAt(old.physical,d.date),after:balanceAt(built.physical,d.date),lock_until:m.lock_until,rental_rate:rentalRate,deferred,damage_total:damageAmount(line.damaged_quantity,item.material_value)});
     if(preview) continue;
     await db.query(`INSERT INTO movements(id,customer_id,item_id,date,type,quantity,lock_until,damaged_quantity,damage_price,note,rental_rate,reference) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,[id,c.id,item.id,m.date,m.type,m.quantity,m.lock_until,line.damaged_quantity,item.material_value,d.note,rentalRate,d.reference]);
     if(m.type==='DISPATCH') await db.query('INSERT INTO dispatch_lots(id,customer_id,item_id,original_quantity,dispatch_date,lock_until) VALUES($1,$2,$3,$4,$5,$6)',[id,c.id,item.id,m.quantity,m.date,m.lock_until]);
     await db.query('DELETE FROM return_allocations WHERE return_id IN (SELECT id FROM movements WHERE customer_id=$1 AND item_id=$2)',[c.id,item.id]);
     for(const a of built.allocations) await db.query('INSERT INTO return_allocations(return_id,lot_id,quantity,return_date,billing_date) VALUES($1,$2,$3,$4,$5)',[a.return_id,a.lot_id,a.quantity,a.return_date,a.billing_date]);
     await audit(db,'MOVEMENT_CREATE',id,{...m,customer_id:c.id});
   }
   return {previews};
 });
}
const invoiceSchema=z.object({customer_id:uuid,period_start:date,period_end:date,gst_percent:z.coerce.number().min(0).max(100),notes:text.default('')});
async function calculateInvoice(db: PoolClient, input: unknown) {
 const d=invoiceSchema.parse(input);
 if(d.period_start>d.period_end) throw new Error('Period start must be before period end.');
 if(d.period_end>today()) throw new Error('Invoice period cannot end in the future. Choose today or an earlier date.');
 const customer=(await db.query('SELECT * FROM customers WHERE id=$1',[d.customer_id])).rows[0];
 if(!customer) throw new Error('Customer not found.');
 const company=(await db.query('SELECT * FROM company WHERE id=1')).rows[0];
 const items=(await db.query('SELECT DISTINCT i.* FROM items i JOIN movements m ON i.id=m.item_id WHERE m.customer_id=$1 ORDER BY i.name',[d.customer_id])).rows;
 const lines: Record<string,unknown>[] = [], damages: Record<string,unknown>[] = [];
 for(const item of items) {
   const ms=(await db.query('SELECT * FROM movements WHERE customer_id=$1 AND item_id=$2 ORDER BY date,created_at,id',[d.customer_id,item.id])).rows.map(m=>({...m,created_at:m.created_at.toISOString()}));
   const rates=(await db.query('SELECT * FROM rates WHERE item_id=$1 ORDER BY effective_from',[item.id])).rows;
   for(const s of rentalSegments(ms,d.period_start,d.period_end,rates)) lines.push({...s,item_id:item.id,name:item.name,hsn:item.hsn});
   for(const m of ms) if(m.date>=d.period_start && m.date<=d.period_end && m.damaged_quantity>0) damages.push({movement_id:m.id,item_id:item.id,name:item.name,date:m.date,quantity:m.damaged_quantity,price:m.damage_price,amount:damageAmount(m.damaged_quantity,m.damage_price)});
 }
 if(!lines.length&&!damages.length) throw new Error('There are no billable items or damage charges in this period.');
 return {...d,company,customer,lines,damages,...totals(lines.map(l=>String(l.amount)),damages.map(l=>String(l.amount)),String(d.gst_percent))};
}
export async function createInvoice(input:unknown,preview=false) {
 return transaction(async db=> {
   await db.query('SELECT pg_advisory_xact_lock(914712)');
   const s=await calculateInvoice(db,input);
   const overlap=await db.query(`SELECT invoice_no FROM invoices WHERE customer_id=$1 AND status='FINAL' AND period_start <= $3 AND period_end >= $2`,[s.customer_id,s.period_start,s.period_end]);
   if(overlap.rows.length) throw new Error(`This period overlaps finalized invoice ${overlap.rows[0].invoice_no}.`);
   if(preview) return s;
   const n=(await db.query("SELECT nextval('invoice_number') AS n")).rows[0].n;
   const year=Number(today().slice(0,4))-(Number(today().slice(5,7))<4?1:0);
   const number=`JE/${String(year).slice(2)}-${String(year+1).slice(2)}/${n}`,id=randomUUID();
   await db.query(`INSERT INTO invoices(id,invoice_no,customer_id,period_start,period_end,gst_percent,snapshot,rental_total,damage_total,subtotal,gst_amount,grand_total,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,[id,number,s.customer_id,s.period_start,s.period_end,s.gst_percent,JSON.stringify(s),s.rental_total,s.damage_total,s.subtotal,s.gst_amount,s.grand_total,s.notes]);
   await audit(db,'INVOICE_DRAFT',id,s); return {id,invoice_no:number};
 });
}
export async function finalizeInvoice(id:string) {
 uuid.parse(id);
 return transaction(async db=> {
   await db.query('SELECT pg_advisory_xact_lock(914712)');
   const invoice=(await db.query('SELECT * FROM invoices WHERE id=$1 FOR UPDATE',[id])).rows[0];
   if(!invoice) throw new Error('Invoice not found.');
   if(invoice.status==='FINAL') return {id};
   const overlap=(await db.query(`SELECT invoice_no FROM invoices WHERE customer_id=$1 AND status='FINAL' AND period_start<=$3 AND period_end>=$2`,[invoice.customer_id,invoice.period_start,invoice.period_end])).rows;
   if(overlap.length) throw new Error(`Period overlaps ${overlap[0].invoice_no}.`);
   const fresh=await calculateInvoice(db,invoice);
   if(JSON.stringify(fresh)!==JSON.stringify(invoice.snapshot)) {
     // JSONB key order is not stable: compare canonicalized snapshots.
     const stable=(v:unknown):string=>JSON.stringify(v,(_k,val)=>val&&typeof val==='object'&&!Array.isArray(val)?Object.fromEntries(Object.entries(val).sort(([a],[b])=>a.localeCompare(b))):val);
     if(stable(fresh)!==stable(invoice.snapshot)) throw new Error('Source data changed since this draft was saved. Generate and review a fresh draft before finalizing.');
   }
   await db.query("UPDATE invoices SET status='FINAL',finalized_at=now() WHERE id=$1",[id]); await audit(db,'INVOICE_FINALIZE',id,{});return {id};
 });
}
export async function updateInvoice(id:string,input:unknown) {
 uuid.parse(id);
 return transaction(async db=>{
   await db.query('SELECT pg_advisory_xact_lock(914712)');
   const old=(await db.query('SELECT status FROM invoices WHERE id=$1 FOR UPDATE',[id])).rows[0];
   if(!old) throw new Error('Invoice not found.');
   if(old.status==='FINAL') throw new Error('Final invoices are locked. Use a credit/debit note.');
   const s=await calculateInvoice(db,input);
   const overlap=(await db.query(`SELECT invoice_no FROM invoices WHERE customer_id=$1 AND status='FINAL' AND period_start<=$3 AND period_end>=$2`,[s.customer_id,s.period_start,s.period_end])).rows;
   if(overlap.length) throw new Error(`Period overlaps finalized invoice ${overlap[0].invoice_no}.`);
   await db.query(`UPDATE invoices SET customer_id=$2,period_start=$3,period_end=$4,gst_percent=$5,snapshot=$6,rental_total=$7,damage_total=$8,subtotal=$9,gst_amount=$10,grand_total=$11,notes=$12 WHERE id=$1`,[id,s.customer_id,s.period_start,s.period_end,s.gst_percent,JSON.stringify(s),s.rental_total,s.damage_total,s.subtotal,s.gst_amount,s.grand_total,s.notes]);
   await audit(db,'INVOICE_DRAFT_UPDATE',id,s);return {id};
 });
}
export async function saveCompany(input:unknown) {
 const d=z.object({name:text.min(1),unit1:text,unit2:text,mobile:text,email:text,website:text,gst_no:text,bank_name:text,bank_account:text,bank_ifsc:text,logo:z.string().max(700000).refine(v=>!v||/^data:image\/(png|jpeg|webp);base64,/.test(v),'Upload a PNG, JPEG or WebP logo'),gst_percent:z.coerce.number().min(0).max(100),terms:text}).parse(input);
 return transaction(async db=>{ await db.query(`UPDATE company SET name=$1,unit1=$2,unit2=$3,mobile=$4,email=$5,website=$6,gst_no=$7,bank_name=$8,bank_account=$9,bank_ifsc=$10,logo=$11,gst_percent=$12,terms=$13 WHERE id=1`,Object.values(d));await audit(db,'COMPANY_SAVE','1',d);return {ok:true}; });
}
export async function saveQuotation(input:unknown) {
 const d=z.object({customer_id:uuid,date,deposit:amount,terms:text,pdc_terms:text.default(''),lines:z.array(z.object({item_id:uuid,quantity:z.coerce.number().int().positive(),rate:amount})).min(1)}).parse(input);
 return transaction(async db=> {
   const customer=(await db.query('SELECT * FROM customers WHERE id=$1',[d.customer_id])).rows[0];
   if(!customer) throw new Error('Customer not found.');
   const company=(await db.query('SELECT * FROM company WHERE id=1')).rows[0];
   const lines=[];
   for(const l of d.lines) {const i=(await db.query('SELECT * FROM items WHERE id=$1',[l.item_id])).rows[0];if(!i) throw new Error('Item not found.');lines.push({...l,name:i.name,material_value:i.material_value,material_total:damageAmount(l.quantity,i.material_value),monthly_total:damageAmount(l.quantity*30,String(l.rate))});}
   const id=randomUUID(),snapshot={...d,customer,company,lines,material_total:money(lines.reduce((s,l)=>s+Number(l.material_total),0)),monthly_total:money(lines.reduce((s,l)=>s+Number(l.monthly_total),0))};
   await db.query('INSERT INTO quotations(id,customer_id,date,snapshot) VALUES($1,$2,$3,$4)',[id,d.customer_id,d.date,JSON.stringify(snapshot)]);return {id};
 });
}
