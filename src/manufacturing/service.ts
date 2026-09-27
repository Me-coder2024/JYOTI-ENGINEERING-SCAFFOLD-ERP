import { randomUUID } from 'node:crypto';
import Decimal from 'decimal.js';
import { z } from 'zod';
import type {PoolClient} from 'pg';
import { pool,transaction } from '@/lib/db';
import {AccessError,type User} from '@/shared/access';
type Row=Record<string,any>;
const text=z.string().trim().max(5000),id=z.string().uuid();
const qty=z.coerce.number().positive().max(999999999).refine(n=>new Decimal(n).decimalPlaces()<=3,'Use at most 3 decimal places.');
const amount=z.coerce.number().min(0).max(999999999).refine(n=>new Decimal(n).decimalPlaces()<=4,'Use at most 4 decimal places.');
export const mfgToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const date=z.string().refine(s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s&&s<=mfgToday(),'Choose a valid date, no later than today.');
export const cash=(value:Decimal.Value)=>new Decimal(value).toDecimalPlaces(2,Decimal.ROUND_HALF_UP).toFixed(2);
export function orderTotal(lines:{quantity:Decimal.Value;rate:Decimal.Value}[]) {return cash(lines.reduce((sum,l)=>sum.add(cash(new Decimal(l.quantity).mul(l.rate))),new Decimal(0)));}
export function invoiceTotals(subtotal:string,gst:Decimal.Value) {const tax=cash(new Decimal(subtotal).mul(gst).div(100));return {subtotal,gst_amount:tax,grand_total:cash(new Decimal(subtotal).add(tax))};}
async function lock(db:PoolClient){await db.query('SELECT pg_advisory_xact_lock(914713)');}
async function audit(db:PoolClient,user:User,action:string,entity:string,details:unknown){await db.query('INSERT INTO erp_audit(user_id,action,entity_id,details) VALUES($1,$2,$3,$4)',[user.id,action,entity,JSON.stringify(details)]);}
const masterTables={suppliers:'mfg_suppliers',customers:'mfg_customers',raw:'mfg_raw_materials',finished:'mfg_finished_goods'} as const;
export type MasterKind=keyof typeof masterTables;
const masterSchema=z.object({id:id.optional(),name:text.min(1),address:text.default(''),gst_no:text.default(''),contact:text.default(''),mobile:text.default(''),unit:z.enum(['kg','pc','mtr']).default('kg'),low_stock_qty:z.coerce.number().min(0).max(999999999).default(0),hsn_code:text.default(''),sale_rate:amount.default(0),unit_weight:amount.default(0),is_active:z.boolean().default(true)});
export async function saveMaster(user:User,kind:string,input:unknown){
 if(!(kind in masterTables))throw new AccessError('Unknown master.');
 if(input&&typeof input==='object'&&'current_stock_qty' in input)throw new AccessError('Stock cannot be edited in a master. Use its stock documents.');
 const d=masterSchema.parse(input),key=d.id||randomUUID(),table=masterTables[kind as MasterKind];
 return transaction(async db=>{await lock(db);const old=d.id?(await db.query(`SELECT * FROM ${table} WHERE id=$1 FOR UPDATE`,[key])).rows[0]:null;
  if(d.id&&!old)throw new AccessError('Record not found.',404);
  if(kind==='raw'&&old&&old.unit!==d.unit){const used=await db.query("SELECT 1 FROM mfg_purchase_orders WHERE lines @> $1::jsonb LIMIT 1",[JSON.stringify([{item_id:key}])]);const bomUse=await db.query('SELECT 1 FROM mfg_boms WHERE lines @> $1::jsonb LIMIT 1',[JSON.stringify([{item_id:key}])]);if(used.rowCount||bomUse.rowCount)throw new AccessError('The unit cannot change after this material has been ordered.');}
  if(kind==='raw')await db.query(`INSERT INTO ${table}(id,name,unit,low_stock_qty,is_active) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET name=$2,unit=$3,low_stock_qty=$4,is_active=$5`,[key,d.name,d.unit,d.low_stock_qty,d.is_active]);
  else if(kind==='finished')await db.query(`INSERT INTO ${table}(id,name,hsn_code,sale_rate,unit_weight,is_active) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET name=$2,hsn_code=$3,sale_rate=$4,unit_weight=$5,is_active=$6`,[key,d.name,d.hsn_code,d.sale_rate,d.unit_weight,d.is_active]);
  else await db.query(`INSERT INTO ${table}(id,name,address,gst_no,contact,mobile,is_active) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET name=$2,address=$3,gst_no=$4,contact=$5,mobile=$6,is_active=$7`,[key,d.name,d.address,d.gst_no,d.contact,d.mobile,d.is_active]);
  await audit(db,user,'MFG_MASTER_SAVE',key,{kind,...d});return {id:key};
 });
}
export async function removeMaster(user:User,kind:string,key:string){
 id.parse(key);if(!(kind in masterTables))throw new AccessError('Unknown master.');
 return transaction(async db=>{await lock(db);const table=masterTables[kind as MasterKind],record=(await db.query(`SELECT * FROM ${table} WHERE id=$1`,[key])).rows[0];if(!record)throw new AccessError('Record not found.',404);
  let referenced=false;
  if(kind==='suppliers'||kind==='customers'){const result=await db.query(`SELECT 1 FROM ${kind==='suppliers'?'mfg_purchase_orders':'mfg_sales_orders'} WHERE ${kind==='suppliers'?'supplier_id':'customer_id'}=$1 LIMIT 1`,[key]);referenced=!!result.rowCount;}
  else{const result=await db.query(`SELECT 1 FROM ${kind==='raw'?'mfg_purchase_orders':'mfg_sales_orders'} WHERE lines @> $1::jsonb LIMIT 1`,[JSON.stringify([{item_id:key}])]);referenced=!!result.rowCount||!!(await db.query('SELECT 1 FROM mfg_stock_journal WHERE item_id=$1 LIMIT 1',[key])).rowCount;}
  if(kind==='customers'||kind==='suppliers')referenced=referenced||!!(await db.query(`SELECT 1 FROM mfg_ledgers WHERE ${kind==='customers'?'customer_id':'supplier_id'}=$1 LIMIT 1`,[key])).rowCount; if(kind==='raw')referenced=referenced||!!(await db.query('SELECT 1 FROM mfg_boms WHERE lines @> $1::jsonb LIMIT 1',[JSON.stringify([{item_id:key}])])).rowCount; if(kind==='finished')referenced=referenced||!!(await db.query('SELECT 1 FROM mfg_boms WHERE finished_good_id=$1 LIMIT 1',[key])).rowCount; if(referenced)await db.query(`UPDATE ${table} SET is_active=false WHERE id=$1`,[key]);else await db.query(`DELETE FROM ${table} WHERE id=$1`,[key]);
  await audit(db,user,referenced?'MFG_MASTER_ARCHIVE':'MFG_MASTER_DELETE',key,{kind});return {archived:referenced};
 });
}
const configs={purchase:{table:'mfg_purchase_orders',number:'po_no',sequence:'mfg_po_number',prefix:'JPO',partyTable:'mfg_suppliers',partyKey:'supplier_id',itemTable:'mfg_raw_materials',active:'SENT',partial:'PARTIALLY_RECEIVED',complete:'RECEIVED',movementTable:'mfg_goods_receipts',movementKey:'purchase_order_id'},sales:{table:'mfg_sales_orders',number:'so_no',sequence:'mfg_so_number',prefix:'JSO',partyTable:'mfg_customers',partyKey:'customer_id',itemTable:'mfg_finished_goods',active:'CONFIRMED',partial:'PARTIALLY_DISPATCHED',complete:'DISPATCHED',movementTable:'mfg_dispatch_notes',movementKey:'sales_order_id'}} as const;
type OrderKind=keyof typeof configs;
function config(kind:string){if(!(kind in configs))throw new AccessError('Unknown order type.');return configs[kind as OrderKind];}
async function documentNumber(db:PoolClient,sequence:string,prefix:string,onDate:string){const n=(await db.query(`SELECT nextval('${sequence}') AS n`)).rows[0].n,year=Number(onDate.slice(0,4))-(Number(onDate.slice(5,7))<4?1:0);return `${prefix}/${String(year).slice(2)}-${String(year+1).slice(2)}/${String(n).padStart(4,'0')}`;}
const orderSchema=z.object({id:id.optional(),party_id:id,date,notes:text.default(''),lines:z.array(z.object({item_id:id,quantity:qty,rate:amount})).min(1).max(100)});
export async function saveOrder(user:User,kind:string,input:unknown){const c=config(kind),d=orderSchema.parse(input);
 if(new Set(d.lines.map(l=>l.item_id)).size!==d.lines.length)throw new AccessError('Add each item only once per order.');
 return transaction(async db=>{await lock(db);const key=d.id||randomUUID(),old=d.id?(await db.query(`SELECT * FROM ${c.table} WHERE id=$1 FOR UPDATE`,[key])).rows[0]:null;
  if(d.id&&!old)throw new AccessError('Order not found.',404);if(old&&old.status!=='DRAFT')throw new AccessError('Only draft orders can be edited.');
  const party=(await db.query(`SELECT * FROM ${c.partyTable} WHERE id=$1 AND is_active`,[d.party_id])).rows[0];if(!party)throw new AccessError('Choose an active '+(kind==='purchase'?'supplier.':'customer.'));
  const lines:Row[]=[];for(const l of d.lines){const item=(await db.query(`SELECT * FROM ${c.itemTable} WHERE id=$1 AND is_active`,[l.item_id])).rows[0];if(!item)throw new AccessError('Choose active items.');if((kind==='sales'||item.unit==='pc')&&!Number.isInteger(l.quantity))throw new AccessError('Piece quantities must be whole numbers.');lines.push({...l,name:item.name,unit:item.unit||'pc',hsn_code:item.hsn_code||'',amount:cash(new Decimal(l.quantity).mul(l.rate))});}
  const total=orderTotal(d.lines),number=old?.[c.number]||await documentNumber(db,c.sequence,c.prefix,d.date);
  await db.query(`INSERT INTO ${c.table}(id,${c.number},${c.partyKey},date,status,lines,party_snapshot,total_amount,notes,created_by) VALUES($1,$2,$3,$4,'DRAFT',$5,$6,$7,$8,$9) ON CONFLICT(id) DO UPDATE SET ${c.partyKey}=$3,date=$4,lines=$5,party_snapshot=$6,total_amount=$7,notes=$8`,[key,number,d.party_id,d.date,JSON.stringify(lines),JSON.stringify(party),total,d.notes,user.id]);
  await audit(db,user,'MFG_ORDER_SAVE',key,{kind,number,total});return {id:key,number};
 });
}
export async function transitionOrder(user:User,kind:string,key:string,action:string){const c=config(kind);id.parse(key);
 return transaction(async db=>{await lock(db);const order=(await db.query(`SELECT * FROM ${c.table} WHERE id=$1 FOR UPDATE`,[key])).rows[0];if(!order)throw new AccessError('Order not found.',404);
  const status=action==='activate'?c.active:action==='cancel'?'CANCELLED':null;if(!status)throw new AccessError('Unknown action.');
  if(action==='activate'&&order.status!=='DRAFT')throw new AccessError('Only a draft can be activated.');
  if(action==='cancel'&&!['DRAFT',c.active].includes(order.status))throw new AccessError('An order with posted movements cannot be cancelled.');
  await db.query(`UPDATE ${c.table} SET status=$2 WHERE id=$1`,[key,status]);await audit(db,user,'MFG_ORDER_STATUS',key,{kind,status});return {id:key,status};
 });
}
export function receivedQuantities(documents:Row[]){const map=new Map<string,Decimal>();for(const doc of documents)for(const line of doc.lines)map.set(line.item_id,(map.get(line.item_id)||new Decimal(0)).add(line.quantity));return map;}
const movementSchema=z.object({id:id,order_id:id,date,notes:text.default(''),lines:z.array(z.object({item_id:id,quantity:qty})).min(1).max(100)});
export async function postMovement(user:User,kind:string,input:unknown){const c=config(kind),d=movementSchema.parse(input);
 if(new Set(d.lines.map(l=>l.item_id)).size!==d.lines.length)throw new AccessError('Add each item only once.');
 return transaction(async db=>{await lock(db);
  const existing=(await db.query(`SELECT * FROM ${c.movementTable} WHERE id=$1`,[d.id])).rows[0];
  if(existing){if(existing[c.movementKey]!==d.order_id||existing.date!==d.date||JSON.stringify(existing.lines.map((l:Row)=>({item_id:l.item_id,quantity:l.quantity})))!==JSON.stringify(d.lines))throw new AccessError('This submission ID was already used for a different entry.',409);return {id:d.id,repeated:true};}
  const order=(await db.query(`SELECT * FROM ${c.table} WHERE id=$1 FOR UPDATE`,[d.order_id])).rows[0];if(!order)throw new AccessError('Order not found.',404);
  if(![c.active,c.partial].includes(order.status))throw new AccessError('This order is not open for '+(kind==='purchase'?'receipts.':'dispatch.'));
  if(d.date<order.date)throw new AccessError('Movement date cannot be before the order date.');
  const previous=(await db.query(`SELECT * FROM ${c.movementTable} WHERE ${c.movementKey}=$1`,[order.id])).rows,done=receivedQuantities(previous),lines:Row[]=[];
  for(const line of d.lines){const original=order.lines.find((l:Row)=>l.item_id===line.item_id);if(!original)throw new AccessError('This item is not on the selected order.');
   if(original.unit==='pc'&&!Number.isInteger(line.quantity))throw new AccessError('Piece quantities must be whole numbers.');
   const remaining=new Decimal(original.quantity).sub(done.get(line.item_id)||0);if(new Decimal(line.quantity).gt(remaining))throw new AccessError(`${original.name}: only ${remaining} remains on this order.`);
   if(kind==='sales'){
    const journal=(await db.query("SELECT date,quantity FROM mfg_stock_journal WHERE kind='FINISHED' AND item_id=$1",[line.item_id])).rows;
    const grouped=new Map<string,Decimal>();for(const j of [...journal,{date:d.date,quantity:-line.quantity}])grouped.set(j.date,(grouped.get(j.date)||new Decimal(0)).add(j.quantity));
    let balance=new Decimal(0);for(const [onDate,delta] of [...grouped].sort(([a],[b])=>a.localeCompare(b))){balance=balance.add(delta);if(balance.isNegative())throw new AccessError(`${original.name}: insufficient finished stock on ${onDate}. Record its opening stock before dispatch.`);}
   }
   await db.query(`UPDATE ${c.itemTable} SET current_stock_qty=current_stock_qty+$2 WHERE id=$1`,[line.item_id,kind==='purchase'?line.quantity:-line.quantity]);
   await db.query('INSERT INTO mfg_stock_journal(id,kind,item_id,date,quantity,source_id,source_type,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[randomUUID(),kind==='purchase'?'RAW':'FINISHED',line.item_id,d.date,kind==='purchase'?line.quantity:-line.quantity,d.id,kind==='purchase'?'RECEIPT':'DISPATCH',user.id]);
   lines.push({...line,name:original.name,unit:original.unit});done.set(line.item_id,(done.get(line.item_id)||new Decimal(0)).add(line.quantity));
  }
  const complete=order.lines.every((l:Row)=>(done.get(l.item_id)||new Decimal(0)).eq(l.quantity)),number=await documentNumber(db,kind==='purchase'?'mfg_receipt_number':'mfg_dispatch_number',kind==='purchase'?'GRN':'DN',d.date);
  await db.query(`INSERT INTO ${c.movementTable}(id,${kind==='purchase'?'receipt_no':'dispatch_no'},${c.movementKey},date,lines,notes,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)`,[d.id,number,order.id,d.date,JSON.stringify(lines),d.notes,user.id]);
  await db.query(`UPDATE ${c.table} SET status=$2 WHERE id=$1`,[order.id,complete?c.complete:c.partial]);await audit(db,user,kind==='purchase'?'MFG_GOODS_RECEIPT':'MFG_DISPATCH',d.id,{order_id:order.id,lines,date:d.date});return {id:d.id,number};
 });
}
export async function openingStock(user:User,input:unknown){const d=z.object({id:id,finished_good_id:id,date,quantity:qty,notes:text.min(3)}).parse(input);if(!Number.isInteger(d.quantity))throw new AccessError('Finished goods are counted in whole pieces.');
 return transaction(async db=>{await lock(db);const old=(await db.query('SELECT * FROM mfg_opening_stock WHERE id=$1',[d.id])).rows[0];if(old){if(old.finished_good_id!==d.finished_good_id||Number(old.quantity)!==d.quantity||old.date!==d.date)throw new AccessError('Submission ID already used.',409);return {id:d.id};}
  const item=(await db.query('SELECT * FROM mfg_finished_goods WHERE id=$1 AND is_active FOR UPDATE',[d.finished_good_id])).rows[0];if(!item)throw new AccessError('Choose an active finished good.');
  if((await db.query('SELECT 1 FROM mfg_stock_journal WHERE item_id=$1',[item.id])).rowCount)throw new AccessError('Opening stock can only be recorded once, before this item has stock movements.');
  await db.query('INSERT INTO mfg_opening_stock(id,finished_good_id,date,quantity,notes,created_by) VALUES($1,$2,$3,$4,$5,$6)',[d.id,item.id,d.date,d.quantity,d.notes,user.id]);
  await db.query('UPDATE mfg_finished_goods SET current_stock_qty=current_stock_qty+$2 WHERE id=$1',[item.id,d.quantity]);
  await db.query("INSERT INTO mfg_stock_journal(id,kind,item_id,date,quantity,source_id,source_type,created_by) VALUES($1,'FINISHED',$2,$3,$4,$5,'OPENING',$6)",[randomUUID(),item.id,d.date,d.quantity,d.id,user.id]);await audit(db,user,'MFG_OPENING_STOCK',d.id,d);return {id:d.id};
 });
}
export async function issueInvoice(user:User,input:unknown){const d=z.object({sales_order_id:id,date,gst_percent:z.coerce.number().min(0).max(100).refine(n=>new Decimal(n).decimalPlaces()<=2,'Use at most 2 decimal places for GST.'),notes:text.default('')}).parse(input);
 return transaction(async db=>{await lock(db);const order=(await db.query('SELECT * FROM mfg_sales_orders WHERE id=$1 FOR UPDATE',[d.sales_order_id])).rows[0];if(!order)throw new AccessError('Sales order not found.',404);if(order.status!=='DISPATCHED')throw new AccessError('Fully dispatch the sales order before issuing its invoice.');
  const last=(await db.query('SELECT max(date) AS date FROM mfg_dispatch_notes WHERE sales_order_id=$1',[order.id])).rows[0].date;if(last&&d.date<last)throw new AccessError('Invoice date cannot precede the last dispatch.');
  // Sole rental-data access: read-only letterhead snapshot, permitted by the specification.
  const company=(await db.query('SELECT * FROM company WHERE id=1')).rows[0];if(!company)throw new AccessError('Company letterhead is not configured.');
  const totals=invoiceTotals(order.total_amount,d.gst_percent),key=randomUUID(),number=await documentNumber(db,'mfg_invoice_number','JM',d.date),snapshot={company,customer:order.party_snapshot,order_no:order.so_no,lines:order.lines,...totals,gst_percent:d.gst_percent,notes:d.notes};
  await db.query(`INSERT INTO mfg_sales_invoices(id,invoice_no,sales_order_id,customer_id,date,snapshot,subtotal,gst_percent,gst_amount,grand_total,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,[key,number,order.id,order.customer_id,d.date,JSON.stringify(snapshot),totals.subtotal,d.gst_percent,totals.gst_amount,totals.grand_total,user.id]);
  await db.query("UPDATE mfg_sales_orders SET status='INVOICED' WHERE id=$1",[order.id]);await audit(db,user,'MFG_INVOICE_ISSUED',key,{number,order_id:order.id,...totals});return {id:key,number};
 });
}
export async function getState(){
 const names=['mfg_suppliers','mfg_customers','mfg_raw_materials','mfg_finished_goods','mfg_purchase_orders','mfg_goods_receipts','mfg_sales_orders','mfg_dispatch_notes','mfg_sales_invoices','mfg_opening_stock','mfg_stock_journal'];
 const results=await Promise.all(names.map(table=>pool.query(`SELECT * FROM ${table} ORDER BY ${['mfg_suppliers','mfg_customers','mfg_raw_materials','mfg_finished_goods'].includes(table)?'name':'created_at DESC'}`)));
 const [suppliers,customers,raw,finished,purchase,receipts,sales,dispatches,invoices,openings,journal]=results.map(r=>r.rows);
 const today=mfgToday();return {suppliers,customers,raw,finished,purchase,receipts,sales,dispatches,invoices,openings,journal,today};
}
export async function getDocument(kind:string,key:string){id.parse(key);const table=kind==='invoice'?'mfg_sales_invoices':kind==='purchase'?'mfg_purchase_orders':kind==='sales'?'mfg_sales_orders':kind==='receipt'?'mfg_goods_receipts':kind==='dispatch'?'mfg_dispatch_notes':null;if(!table)throw new AccessError('Unknown document.');const record=(await pool.query(`SELECT * FROM ${table} WHERE id=$1`,[key])).rows[0];if(!record)throw new AccessError('Document not found.',404);return record;}
