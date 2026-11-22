'use client';
import {useState} from 'react';
import {challanKey} from './challan-groups';
type Row=Record<string,any>;
export default function MovementCorrection({record,data,busy,onSave}:{record:Row;data:Row;busy:boolean;onSave:(value:Row)=>Promise<boolean>}){
 const original=data.movements.filter((m:Row)=>challanKey(m)===challanKey(record));
 const [lines,setLines]=useState<Row[]>(original.map((m:Row)=>({...m}))),[error,setError]=useState('');
 function update(i:number,value:Row){setLines(rows=>rows.map((r,n)=>n===i?{...r,...value}:r));}
 return <form onSubmit={async e=>{e.preventDefault();setError('');const values=Object.fromEntries(new FormData(e.currentTarget));if(!await onSave({...values,id:record.id,versions:original.map((r:Row)=>({id:r.id,revision:r.revision})),action:'EDIT',lines:lines.map(l=>({...l,rental_rate:l.rental_rate===''?null:l.rental_rate}))}))setError('Changes were not saved. Review the error and retry.');}}>
 <h3>Challan {record.reference||'Legacy entry'}</h3><p>The challan number, customer and accounting site are retained. Finalized invoices remain protected.</p>
 <label className="field">Date<input name="date" type="date" required max={data.today} defaultValue={record.date}/></label>
 <label className="field">Contact phone number<input name="contact_phone" type="tel" maxLength={40} defaultValue={record.contact_phone||''}/></label>
 <label className="field">Delivery Site<textarea name="delivery_site" maxLength={2000} defaultValue={record.delivery_site||''}/></label>
 <label className="field">Vehicle number<input name="vehicle_no" maxLength={40} defaultValue={record.vehicle_no||''}/></label>
 {lines.map((l,i)=><div className="form-section" key={l.id||i}><label className="field">Material<select required disabled={!!l.id} value={l.item_id} onChange={e=>update(i,{item_id:e.target.value})}><option value="">Select material</option>{data.items.map((item:Row)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field">Quantity<input type="number" required min={1} step={1} value={l.quantity} onChange={e=>update(i,{quantity:Number(e.target.value)})}/></label><label className="field">Stock type<select value={l.stock_type||'Rent'} onChange={e=>update(i,{stock_type:e.target.value})}><option>Rent</option><option>New Rent</option></select></label>{record.type==='DISPATCH'?<label className="field">Daily rental rate<input type="number" min={0} step="0.0001" required={!l.id} value={l.rental_rate??''} onChange={e=>update(i,{rental_rate:e.target.value})}/></label>:<label className="field">Damaged quantity<input type="number" min={0} max={l.quantity} value={l.damaged_quantity||0} onChange={e=>update(i,{damaged_quantity:Number(e.target.value)})}/></label>}<button type="button" className="secondary" disabled={lines.length===1} onClick={()=>setLines(v=>v.filter((_,n)=>n!==i))}>Remove item</button></div>)}
 <button type="button" className="secondary" onClick={()=>setLines(v=>[...v,{item_id:'',quantity:1,damaged_quantity:0,rental_rate:'',stock_type:'Rent'}])}>Add item</button>
 <label className="field">Notes<textarea name="note" defaultValue={record.note}/></label><label className="field">Reason for correction<textarea required minLength={3} maxLength={2000} name="reason"/></label>{error&&<p className="alert error">{error}</p>}<button className="primary" disabled={busy}>Save challan</button></form>;
}
