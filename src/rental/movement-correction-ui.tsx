'use client';
import {useState} from 'react';
type Row=Record<string,any>;
export default function MovementCorrection({record,data,busy,onSave}:{record:Row;data:Row;busy:boolean;onSave:(value:Row)=>Promise<boolean>}){
 const [action,setAction]=useState('EDIT'),[error,setError]=useState(''),[confirmed,setConfirmed]=useState(false);
 return <form onSubmit={async e=>{e.preventDefault();setError('');const f=Object.fromEntries(new FormData(e.currentTarget));if(action==='DELETE'&&!confirmed){setError('Confirm deletion below before continuing.');return;}const ok=await onSave(action==='DELETE'?{id:record.id,revision:record.revision,action,reason:f.reason}:{...f,id:record.id,revision:record.revision,action,quantity:Number(f.quantity),damaged_quantity:Number(f.damaged_quantity||0),...(record.type==='DISPATCH'?{rental_rate:f.rental_rate===''?null:Number(f.rental_rate)}:{})});if(!ok)setError('Correction was not saved. Review the error above; your entered details remain here.');}}>
 <p><strong>{data.customers.find((c:Row)=>c.id===record.customer_id)?.name}</strong><br/>{data.items.find((i:Row)=>i.id===record.item_id)?.name} - {record.type}</p>
 <p className="panel-note">This corrects one material line. The original record and reason are retained in history. Later returns are recalculated; finalized invoices cannot be changed. Regenerate any affected draft invoices.</p>
 <label className="field"><span>Action</span><select value={action} onChange={e=>{setAction(e.target.value);setConfirmed(false);}}><option value="EDIT">Edit entry</option><option value="DELETE">Delete entry</option></select></label>
 <fieldset disabled={action==='DELETE'} style={{display:action==='DELETE'?'none':undefined,border:0,padding:0,margin:0}} className="form-grid">
 <label className="field"><span>Date</span><input name="date" type="date" required max={data.today} defaultValue={record.date}/></label>
 <label className="field"><span>Quantity</span><input name="quantity" type="number" required min="1" step="1" defaultValue={record.quantity}/></label>
 {record.type==='RETURN'?<label className="field"><span>Damaged quantity</span><input name="damaged_quantity" type="number" required min="0" step="1" defaultValue={record.damaged_quantity}/></label>:<label className="field"><span>Agreed daily rate</span><input name="rental_rate" type="number" min="0" step="0.0001" defaultValue={record.rental_rate??''}/><small>Blank preserves historical rate-card billing.</small></label>}
 <label className="field"><span>Reference</span><input name="reference" maxLength={80} defaultValue={record.reference}/></label>
 <label className="field"><span>Notes</span><textarea name="note" defaultValue={record.note}/></label></fieldset>
 <label className="field"><span>Reason for correction</span><textarea name="reason" required minLength={3} maxLength={2000}/></label>
 {action==='DELETE'&&<label className="m-check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I confirm deleting this material line from active stock and billing. Its audit history will be retained.</label>}
 {error&&<p className="alert error">{error}</p>}<button className="primary" disabled={busy}>{busy?'Saving...':action==='DELETE'?'Delete with audit history':'Save correction'}</button>
 </form>;
}
