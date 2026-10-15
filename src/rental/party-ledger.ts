import Decimal from 'decimal.js';
type Row=Record<string,any>;
export function partyStatement(vouchers:Row[],ledgerId:string,start:string,end:string){
 let opening=new Decimal(0),running=new Decimal(0),debit=new Decimal(0),credit=new Decimal(0);
 const rows:Row[]=[];
 for(const v of [...vouchers].sort((a,b)=>a.date.localeCompare(b.date)||new Date(a.created_at).getTime()-new Date(b.created_at).getTime()||a.voucher_no.localeCompare(b.voucher_no)||a.id.localeCompare(b.id))){
  if(v.date>end)continue;
  for(const l of v.lines.filter((l:Row)=>l.ledger_id===ledgerId)){
   const delta=new Decimal(l.debit).sub(l.credit);
   if(v.date<start){opening=opening.add(delta);continue;}
   rows.push({id:v.id,date:v.date,type:v.type,reference:v.voucher_no,narration:[v.narration,v.reference].filter(Boolean).join(' | '),debit:String(l.debit),credit:String(l.credit),source_invoice_id:v.source_invoice_id});
  }
 }
 running=opening;
 for(const row of rows){debit=debit.add(row.debit);credit=credit.add(row.credit);running=running.add(row.debit).sub(row.credit);row.balance=running.toFixed(2);}
 return {opening:opening.toFixed(2),rows,debit:debit.toFixed(2),credit:credit.toFixed(2),closing:running.toFixed(2)};
}
export const balanceText=(value:string)=>new Decimal(value).abs().toFixed(2)+(new Decimal(value).gte(0)?' Dr':' Cr');
