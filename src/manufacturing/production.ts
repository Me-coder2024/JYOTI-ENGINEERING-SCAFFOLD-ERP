import {randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import Decimal from 'decimal.js';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import {pool,transaction} from '@/lib/db';
import {AccessError,type User} from '@/shared/access';
import {mfgToday} from './service';
const id=z.string().uuid(), notes=z.string().trim().max(2000).default('');
const date=z.string().refine(s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s,'Choose a valid date.');
const pastDate=date.refine(s=>s<=mfgToday(),'Date cannot be in the future.');
const quantity=z.coerce.number().positive().max(10000000).refine(n=>new Decimal(n).decimalPlaces()<=3,'Use at most 3 decimal places.');
const pieces=z.coerce.number().int().min(1).max(10000000);
async function lock(db:PoolClient){await db.query('SELECT pg_advisory_xact_lock(914713)');}
async function audit(db:PoolClient,user:User,action:string,key:string,details:unknown){await db.query('INSERT INTO erp_audit(user_id,action,entity_id,details) VALUES($1,$2,$3,$4)',[user.id,action,key,JSON.stringify(details)]);}
export async function saveBom(user:User,input:unknown){
 const d=z.object({finished_good_id:id,notes,lines:z.array(z.object({item_id:id,quantity})).min(1).max(100)}).parse(input);
 if(new Set(d.lines.map(l=>l.item_id)).size!==d.lines.length)throw new AccessError('List each raw material only once.');
 return transaction(async db=>{await lock(db);
  const product=(await db.query('SELECT * FROM mfg_finished_goods WHERE id=$1 AND is_active',[d.finished_good_id])).rows[0];if(!product)throw new AccessError('Choose an active finished good.');
  const lines=[];for(const l of d.lines){const raw=(await db.query('SELECT * FROM mfg_raw_materials WHERE id=$1 AND is_active',[l.item_id])).rows[0];if(!raw)throw new AccessError('Choose active raw materials.');if(raw.unit==='pc'&&!Number.isInteger(l.quantity))throw new AccessError('Piece materials must use whole pieces per finished unit.');lines.push({...l,name:raw.name,unit:raw.unit});}
  const revision=Number((await db.query('SELECT COALESCE(max(revision),0)+1 revision FROM mfg_boms WHERE finished_good_id=$1',[product.id])).rows[0].revision),key=randomUUID();
  await db.query('UPDATE mfg_boms SET is_active=false WHERE finished_good_id=$1 AND is_active',[product.id]);
  await db.query('INSERT INTO mfg_boms(id,finished_good_id,revision,product_name,lines,notes,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)',[key,product.id,revision,product.name,JSON.stringify(lines),d.notes,user.id]);
  await audit(db,user,'MFG_BOM_REVISION',key,{...d,revision});return {id:key,revision};
 });
}
export async function saveWorkOrder(user:User,input:unknown){
 const d=z.object({id,bom_id:id,quantity:pieces,date:pastDate,due_date:z.union([date,z.literal('')]).optional(),notes}).parse(input);
 if(d.due_date&&d.due_date<d.date)throw new AccessError('Due date must be on or after the work-order date.');
 return transaction(async db=>{await lock(db);
  const existing=(await db.query('SELECT * FROM mfg_work_orders WHERE id=$1',[d.id])).rows[0];if(existing){if(existing.bom_id!==d.bom_id||existing.quantity!==d.quantity||existing.date!==d.date||(existing.due_date||'')!==(d.due_date||'')||existing.notes!==d.notes)throw new AccessError('Submission already used for a different work order.',409);return {id:existing.id};}
  const bom=(await db.query('SELECT b.* FROM mfg_boms b JOIN mfg_finished_goods f ON f.id=b.finished_good_id WHERE b.id=$1 AND b.is_active AND f.is_active',[d.bom_id])).rows[0];if(!bom)throw new AccessError('Choose the current BOM of an active finished good.');
  const number='WO/'+d.date.slice(0,4)+'/'+String((await db.query("SELECT nextval('mfg_work_order_number') n")).rows[0].n).padStart(5,'0');
  await db.query('INSERT INTO mfg_work_orders(id,work_order_no,bom_id,finished_good_id,product_name,bom_snapshot,quantity,date,due_date,notes,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[d.id,number,bom.id,bom.finished_good_id,bom.product_name,JSON.stringify(bom),d.quantity,d.date,d.due_date||null,d.notes,user.id]);
  await audit(db,user,'MFG_WORK_ORDER_CREATED',d.id,d);return {id:d.id,number};
 });
}
export async function transitionWorkOrder(user:User,input:unknown){
 const d=z.object({id,action:z.enum(['release','cancel'])}).parse(input);
 return transaction(async db=>{await lock(db);const order=(await db.query('SELECT * FROM mfg_work_orders WHERE id=$1 FOR UPDATE',[d.id])).rows[0];if(!order)throw new AccessError('Work order not found.',404);
  if(d.action==='release'&&order.status!=='DRAFT')throw new AccessError('Only draft work orders can be released.');
  if(d.action==='cancel'&&(!['DRAFT','RELEASED'].includes(order.status)||order.completed_quantity))throw new AccessError('A work order with posted production cannot be cancelled.');
  const status=d.action==='release'?'RELEASED':'CANCELLED';await db.query('UPDATE mfg_work_orders SET status=$2 WHERE id=$1',[d.id,status]);await audit(db,user,'MFG_WORK_ORDER_STATUS',d.id,{status});return {id:d.id,status};
 });
}
async function checkStock(db:PoolClient,itemId:string,onDate:string,required:Decimal,name:string){
 const journal=(await db.query("SELECT date,sum(quantity) quantity FROM mfg_stock_journal WHERE kind='RAW' AND item_id=$1 GROUP BY date",[itemId])).rows;
 const changes=new Map<string,Decimal>(journal.map(j=>[j.date,new Decimal(j.quantity)]));changes.set(onDate,(changes.get(onDate)||new Decimal(0)).sub(required));
 let balance=new Decimal(0);for(const [day,delta] of [...changes].sort(([a],[b])=>a.localeCompare(b))){balance=balance.add(delta);if(balance.lt(0))throw new AccessError(`${name}: insufficient raw stock on ${day}. Required for this entry: ${required}. Record the actual receipt first.`);}
}
export async function postProduction(user:User,input:unknown){
 const d=z.object({id,work_order_id:id,date:pastDate,quantity:pieces,notes:z.string().trim().min(3).max(2000),labour_cost:z.coerce.number().min(0).max(999999999).refine(n=>new Decimal(n).decimalPlaces()<=2,'Use 2 decimal places for labour cost.').default(0),wastage:z.array(z.object({item_id:id,quantity:z.coerce.number().min(0).max(10000000).refine(n=>new Decimal(n).decimalPlaces()<=3)})).default([])}).parse(input);
 if(new Set(d.wastage.map(l=>l.item_id)).size!==d.wastage.length)throw new AccessError('Enter wastage once for each material.');
 d.wastage.sort((a,b)=>a.item_id.localeCompare(b.item_id));
 return transaction(async db=>{await lock(db);const existing=(await db.query('SELECT * FROM mfg_production_entries WHERE id=$1',[d.id])).rows[0];if(existing){if(!isDeepStrictEqual(existing.request_snapshot,d))throw new AccessError('Submission already used for different production.',409);return {id:d.id,repeated:true};}
  const order=(await db.query('SELECT * FROM mfg_work_orders WHERE id=$1 FOR UPDATE',[d.work_order_id])).rows[0];if(!order)throw new AccessError('Work order not found.',404);
  if(!['RELEASED','IN_PROGRESS'].includes(order.status))throw new AccessError('Release the work order before recording production.');
  if(d.date<order.date)throw new AccessError('Production date cannot precede its work order.');
  if(d.quantity>order.quantity-order.completed_quantity)throw new AccessError(`Only ${order.quantity-order.completed_quantity} pieces remain on this work order.`);
  const bomLines=order.bom_snapshot.lines as {item_id:string;name:string;unit:string;quantity:number}[];
  if(d.wastage.some(w=>!bomLines.some(l=>l.item_id===w.item_id)))throw new AccessError('Wastage must refer to this work order’s BOM materials.');
  const consumption=[];for(const l of bomLines){const waste=new Decimal(d.wastage.find(w=>w.item_id===l.item_id)?.quantity||0),standard=new Decimal(l.quantity).mul(d.quantity),total=standard.add(waste);if(l.unit==='pc'&&!waste.isInteger())throw new AccessError('Piece wastage must be a whole number.');await checkStock(db,l.item_id,d.date,total,l.name);
   consumption.push({item_id:l.item_id,name:l.name,unit:l.unit,standard:standard.toString(),wastage:waste.toString(),quantity:total.toString()});
   await db.query('UPDATE mfg_raw_materials SET current_stock_qty=current_stock_qty-$2 WHERE id=$1',[l.item_id,total.toString()]);
   await db.query("INSERT INTO mfg_stock_journal(id,kind,item_id,date,quantity,source_id,source_type,created_by) VALUES($1,'RAW',$2,$3,$4,$5,'PRODUCTION_INPUT',$6)",[randomUUID(),l.item_id,d.date,total.negated().toString(),d.id,user.id]);
  }
  await db.query('UPDATE mfg_finished_goods SET current_stock_qty=current_stock_qty+$2 WHERE id=$1',[order.finished_good_id,d.quantity]);
  await db.query("INSERT INTO mfg_stock_journal(id,kind,item_id,date,quantity,source_id,source_type,created_by) VALUES($1,'FINISHED',$2,$3,$4,$5,'PRODUCTION_OUTPUT',$6)",[randomUUID(),order.finished_good_id,d.date,d.quantity,d.id,user.id]);
  await db.query('INSERT INTO mfg_production_entries(id,work_order_id,date,quantity,consumption,labour_cost,notes,request_snapshot,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[d.id,order.id,d.date,d.quantity,JSON.stringify(consumption),d.labour_cost,d.notes,JSON.stringify(d),user.id]);
  const completed=order.completed_quantity+d.quantity;await db.query('UPDATE mfg_work_orders SET completed_quantity=$2,status=$3 WHERE id=$1',[order.id,completed,completed===order.quantity?'COMPLETED':'IN_PROGRESS']);
  await audit(db,user,'MFG_PRODUCTION_POSTED',d.id,{...d,consumption});return {id:d.id};
 });
}
export async function productionState(){const [boms,workorders,production]=await Promise.all(['mfg_boms','mfg_work_orders','mfg_production_entries'].map(t=>pool.query(`SELECT * FROM ${t} ORDER BY created_at DESC`)));return {boms:boms.rows,workorders:workorders.rows,production:production.rows};}
