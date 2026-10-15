'use client';
import {partyStatement,balanceText} from './party-ledger';
export default function PartyLedger({data,ledgerId,from,to,onOpen}:{data:any;ledgerId:string;from:string;to:string;onOpen:(record:any)=>void}){
 if(!ledgerId)return <p className="m-help">Select a party or account to see every posted entry and payment.</p>;
 const start=from||'1900-01-01',end=to||data.today;
 if(start>end)return <p className="alert error">From date must be on or before To date.</p>;
 const report=partyStatement(data.vouchers,ledgerId,start,end);
 const url='/api/rental/accounting/party-ledger?'+new URLSearchParams({ledger:ledgerId,start,end});
 return <><div className="m-row-actions"><a className="secondary" target="_blank" rel="noopener noreferrer" href={url+'&format=pdf'}>Print / PDF</a><a className="secondary" href={url+'&format=xlsx'}>Export Excel</a></div>
 <p className="m-help">Includes all posted vouchers, payments, receipts and reversal entries. Rental invoices appear after posting their linked sales voucher. Amounts are INR.</p>
 <section className="m-panel m-table"><table><thead><tr>{['Date','Vhty','Reference','Particulars','Debit','Credit','Balance'].map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>
 <tr><th colSpan={6}>Opening Balance</th><td>{balanceText(report.opening)}</td></tr>
 {report.rows.map((r:any)=><tr key={r.id}><td>{r.date}</td><td>{r.type}</td><td><button className="text-button" onClick={()=>onOpen(data.vouchers.find((v:any)=>v.id===r.id))}>{r.reference}</button></td><td>{r.narration}</td><td>{Number(r.debit).toFixed(2)}</td><td>{Number(r.credit).toFixed(2)}</td><td>{balanceText(r.balance)}</td></tr>)}
 </tbody><tfoot><tr><th colSpan={4}>Closing Balance</th><th>{report.debit}</th><th>{report.credit}</th><th>{balanceText(report.closing)}</th></tr></tfoot></table></section></>;
}
