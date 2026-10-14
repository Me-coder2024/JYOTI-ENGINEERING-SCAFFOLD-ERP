'use client';
import {useRef,useState} from 'react';
import SearchSelect from '@/manufacturing/search-select';
type Row=Record<string,any>;
const bank=(l:Row)=>['Bank Accounts','Cash-in-Hand'].includes(l.group_name);
export default function SimpleVoucher({data,busy,save}:{data:Row;busy:boolean;save:(d:Row)=>unknown}){
 const [id]=useState(()=>crypto.randomUUID()),[type,setType]=useState('Receipt'),[party,setParty]=useState(''),[account,setAccount]=useState(''),[amount,setAmount]=useState(''),[allocations,setAllocations]=useState<Record<string,string>>({});
 const submitting=useRef(false);
 const ledgers=data.ledgers.filter((l:Row)=>l.is_active),customer=ledgers.find((l:Row)=>l.id===party)?.customer_id;
 const invoices=data.invoices.filter((i:Row)=>i.customer_id===customer&&Number(i.outstanding)>0);
 return <form onSubmit={async e=>{e.preventDefault();if(submitting.current)return;submitting.current=true;const fields=Object.fromEntries(new FormData(e.currentTarget));try{await save({...fields,id,type,entry_mode:'simple',party_ledger_id:party,bank_ledger_id:account,amount,details:{allocations:type==='Receipt'?Object.entries(allocations).filter(([,v])=>Number(v)>0).map(([invoice_id,amount])=>({invoice_id,amount:Number(amount)})):[]}});}finally{submitting.current=false;}}}>
 <p className="m-help">Enter the amount once. The corresponding debit and credit are posted automatically.</p>
 <div className="m-form-grid">
 <label className="m-field"><span>Voucher type</span><select required value={type} onChange={e=>{setType(e.target.value);setAllocations({});}}><option>Receipt</option><option>Payment</option></select></label>
 <label className="m-field"><span>Date</span><input name="date" required type="date" defaultValue={data.today} max={data.today}/></label>
 <label className="m-field"><span>Party / expense account</span><SearchSelect required value={party} onChange={id=>{setParty(id);setAllocations({});}} options={ledgers.filter((l:Row)=>!bank(l)).map((l:Row)=>({id:l.id,name:l.name}))}/></label>
 <label className="m-field"><span>Bank / cash account</span><SearchSelect required value={account} onChange={setAccount} options={ledgers.filter(bank).map((l:Row)=>({id:l.id,name:l.name}))}/></label>
 <label className="m-field"><span>Amount (INR)</span><input required type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></label>
 <label className="m-field"><span>Reference</span><input name="reference"/></label>
 </div>
 {type==='Receipt'&&customer&&<section><h3>Invoice allocations</h3><p className="m-help">Leave blank to retain customer credit. Any unallocated remainder stays on the customer account.</p>{invoices.map((i:Row)=><label className="m-field" key={i.id}><span>{i.invoice_no}   outstanding INR {i.outstanding}</span><input type="number" min="0" max={i.outstanding} step="0.01" value={allocations[i.id]||''} onChange={e=>setAllocations({...allocations,[i.id]:e.target.value})}/></label>)}</section>}
 <label className="m-field"><span>Narration</span><textarea required name="narration" minLength={3}/></label>
 <button className="primary" disabled={busy||!party||!account||Number(amount)<=0}>{busy?'Saving...':'Save '+type.toLowerCase()}</button>
 </form>;
}
