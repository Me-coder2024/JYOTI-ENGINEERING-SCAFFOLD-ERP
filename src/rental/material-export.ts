import {transaction} from '@/lib/db';
import {materialGroups} from './material-ledger';
import {z} from 'zod';
import {loadFormats} from './ledger-format-service';
import {renderLedger,type ReportRow} from './ledger-render';
export const reportDate=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v);
export async function materialExport(params:URLSearchParams){
 const d=z.object({customer:z.string().uuid(),start:reportDate,end:reportDate,item:z.union([z.string().uuid(),z.literal('')]).default(''),format:z.enum(['pdf','xlsx']).default('pdf')}).parse(Object.fromEntries(params));
 if(d.start>d.end)throw new Error('Choose a valid date range.');
 const report=await transaction(async db=>{
  const c=(await db.query('SELECT * FROM customers WHERE id=$1',[d.customer])).rows[0];if(!c)throw new Error('Customer not found.');
  const items=(await db.query('SELECT id,name FROM items ORDER BY name')).rows;
  const moves=(await db.query('SELECT id,item_id,date,type,quantity,reference,created_at FROM movements WHERE customer_id=$1 AND date<=$2 ORDER BY date,created_at,id',[d.customer,d.end])).rows;
  const groups=materialGroups(items,moves,d.start,d.end,d.item),rows:ReportRow[]=[];
  for(const g of groups){
   rows.push({values:{Date:'Opening Balance','Item Name':g.name,'Pend.Qty':g.opening},strong:true});
   let running=g.opening;
   for(const m of g.rows){running+=m.type==='DISPATCH'?Number(m.quantity):-Number(m.quantity);rows.push({values:{Date:m.date,Vhty:m.type==='DISPATCH'?'Outw':'Inwr',Reference:m.reference||m.id.slice(0,8),'Item Name':g.name,'Issu Qty':m.type==='DISPATCH'?Number(m.quantity):'','Rcpt Qty':m.type==='RETURN'?Number(m.quantity):'','Pend.Qty':running}});}
   rows.push({values:{'Item Name':'Sub Total','Issu Qty':g.issued,'Rcpt Qty':g.received,'Pend.Qty':g.pending},strong:true});
  }
  const total=groups.reduce((t,g)=>({issued:t.issued+g.issued,received:t.received+g.received,pending:t.pending+g.pending}),{issued:0,received:0,pending:0});
  rows.push({values:{'Item Name':'Closing Balance','Issu Qty':total.issued,'Rcpt Qty':total.received,'Pend.Qty':total.pending},strong:true});
  return {party:c.name,address:[c.address,c.mobile].filter(Boolean).join(' | '),start:d.start,end:d.end,rows};
 },true);
 return renderLedger(report,(await loadFormats()).material,d.format);
}
