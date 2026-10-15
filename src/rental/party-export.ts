import {z} from 'zod';
import {transaction} from '@/lib/db';
import {reportDate} from './material-export';
import {partyStatement,balanceText} from './party-ledger';
import {renderLedger,type ReportRow} from './ledger-render';
import {loadFormats} from './ledger-format-service';
export async function partyExport(params:URLSearchParams){
 const d=z.object({ledger:z.string().uuid(),start:reportDate,end:reportDate,format:z.enum(['pdf','xlsx']).default('pdf')}).parse(Object.fromEntries(params));
 if(d.start>d.end)throw new Error('Choose a valid date range.');
 const report=await transaction(async db=>{
  const ledger=(await db.query('SELECT * FROM rental_acc_ledgers WHERE id=$1',[d.ledger])).rows[0];if(!ledger)throw new Error('Ledger not found.');
  const vouchers=(await db.query('SELECT * FROM rental_acc_vouchers WHERE date<=$1 AND lines @> $2::jsonb',[d.end,JSON.stringify([{ledger_id:d.ledger}])])).rows;
  const summary=partyStatement(vouchers,d.ledger,d.start,d.end);
  const rows:ReportRow[]=[{values:{Particulars:'Opening Balance',Balance:balanceText(summary.opening)},strong:true}];
  for(const row of summary.rows)rows.push({values:{Date:row.date,Vhty:row.type,Reference:row.reference,Particulars:row.narration,Debit:Number(row.debit),Credit:Number(row.credit),Balance:balanceText(row.balance)}});
  rows.push({values:{Particulars:'Closing Balance',Debit:Number(summary.debit),Credit:Number(summary.credit),Balance:balanceText(summary.closing)},strong:true});
  return {party:ledger.party_details?.mailing_name||ledger.name,address:ledger.party_details?.address||'',start:d.start,end:d.end,rows};
 },true);
 return renderLedger(report,(await loadFormats()).party,d.format);
}
