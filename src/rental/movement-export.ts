import {z} from 'zod';
import {transaction} from '@/lib/db';
import {reportDate} from './material-export';
import {renderLedger} from './ledger-render';
import {loadFormats} from './ledger-format-service';
export async function movementExport(params:URLSearchParams){
 const d=z.object({start:reportDate,end:reportDate,format:z.enum(['pdf','xlsx']),type:z.enum(['','DISPATCH','RETURN']).default(''),search:z.string().max(200).default('')}).parse(Object.fromEntries(params));
 if(d.start>d.end)throw new Error('Start date must be on or before end date.');
 const rows=await transaction(async db=>(await db.query(
  "SELECT m.*,c.name customer,i.name item FROM movements m JOIN customers c ON c.id=m.customer_id JOIN items i ON i.id=m.item_id WHERE m.date BETWEEN $1 AND $2 AND ($3='' OR m.type=$3) AND strpos(lower(c.name||' '||i.name),lower($4))>0 ORDER BY m.date,m.created_at,m.id",
  [d.start,d.end,d.type,d.search])).rows,true);
 const settings=(await loadFormats()).material;
 const columns=['Date','Type','Reference','Particulars','Issu Qty','Rcpt Qty','Damaged'];
 return renderLedger({party:d.type==='DISPATCH'?'Dispatch history':d.type==='RETURN'?'Return history':'Dispatch & return history',address:'Active movements only. Deleted lines remain in owner correction history.',start:d.start,end:d.end,rows:rows.map(r=>({values:{Date:r.date,Type:r.type,Reference:r.reference||'',Particulars:r.customer+' / '+r.item,'Issu Qty':r.type==='DISPATCH'?r.quantity:0,'Rcpt Qty':r.type==='RETURN'?r.quantity:0,Damaged:r.damaged_quantity}}))},
 {...settings,title:'DISPATCH & RETURN HISTORY',orientation:'landscape',columns},d.format);
}
