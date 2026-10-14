'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, Plus, X } from 'lucide-react';

type RecordData=Record<string,any>;
type EntryLine={item_id:string;quantity:number;damaged_quantity:number;rental_rate:string;custom_rate:boolean};
const emptyLine=():EntryLine=>({item_id:'',quantity:1,damaged_quantity:0,rental_rate:'',custom_rate:false});
const currency=(value:unknown)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:4}).format(Number(value));
const displayDate=(value:string)=>new Date(value+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
function Field({label,hint,children}:{label:string;hint?:string;children:ReactNode}) {
 return <label className="field"><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>;
}
async function previewMovement(payload:unknown) {
 const response=await fetch('/api/movements/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
 const result=await response.json();
 if(!response.ok) throw new Error(result.error||'Unable to check this entry.');
 return result;
}

/* ── Draft persistence helpers ── */
export const DRAFT_KEY_PREFIX='je_movement_draft_';
export function draftKey(type:string){return DRAFT_KEY_PREFIX+type;}
export interface DraftState{customer:string;date:string;lines:EntryLine[];note:string;reference:string;savedAt:number;}

export function hasDraftContent(state?:{customer?:string;reference?:string;note?:string;lines?:EntryLine[]}):boolean {
 if(!state) return false;
 if(state.customer&&state.customer.trim()!=='') return true;
 if(state.reference&&state.reference.trim()!=='') return true;
 if(state.note&&state.note.trim()!=='') return true;
 if(state.lines&&state.lines.length>1) return true;
 if(state.lines&&state.lines.length===1){
  const line=state.lines[0];
  if(line.item_id!==''||line.rental_rate!==''||line.damaged_quantity>0||(line.quantity!==1&&line.quantity>0)) return true;
 }
 return false;
}

export function saveDraft(type:string,state:Omit<DraftState,'savedAt'>){
 try{
  if(typeof window==='undefined'||typeof localStorage==='undefined') return;
  if(!hasDraftContent(state)){
   clearMovementDraft(type);
   return;
  }
  localStorage.setItem(draftKey(type),JSON.stringify({...state,savedAt:Date.now()}));
 }catch{}
}

export function loadDraft(type:string):DraftState|null{
 try{
  if(typeof window==='undefined'||typeof localStorage==='undefined') return null;
  const raw=localStorage.getItem(draftKey(type));if(!raw) return null;
  const draft=JSON.parse(raw) as DraftState;
  // Discard drafts older than 24 hours or without meaningful data
  if(Date.now()-draft.savedAt>86400000){localStorage.removeItem(draftKey(type));return null;}
  if(!hasDraftContent(draft)){localStorage.removeItem(draftKey(type));return null;}
  return draft;
 }catch{return null;}
}

export function clearMovementDraft(type:string){
 try{
  if(typeof window==='undefined'||typeof localStorage==='undefined') return;
  localStorage.removeItem(draftKey(type));
 }catch{}
}

export default function MovementForm({data,initial,busy,onSave}:{data:RecordData;initial:RecordData;busy:boolean;onSave:(value:RecordData)=>Promise<boolean>}) {
 const isReturn=initial.type==='RETURN';

 // ── Restore draft on mount ──
 const draft=useRef(loadDraft(initial.type));
 const hasDraft=draft.current!==null;
 const restored=draft.current;

 const [customer,setCustomer]=useState(restored?.customer||initial.customer_id||'');
 const [date,setDate]=useState<string>(restored?.date||data.today);
 const [lines,setLines]=useState<EntryLine[]>(restored?.lines?.length?restored.lines:[emptyLine()]);
 const [note,setNote]=useState(restored?.note||'');
 const [reference,setReference]=useState(restored?.reference||'');
 const [preview,setPreview]=useState<RecordData|null>(null);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(false);
 const [retry,setRetry]=useState(0);
 const previewFlight=useRef<Promise<unknown>>(Promise.resolve());
 const [showDraftNotice,setShowDraftNotice]=useState(hasDraft);

 const savedSuccessfullyRef=useRef(false);
 const latestStateRef=useRef({customer,date,lines,note,reference});
 latestStateRef.current={customer,date,lines,note,reference};

 // ── Auto-save draft on every change ──
 useEffect(()=>{
  if(savedSuccessfullyRef.current) return;
  saveDraft(initial.type,{customer,date,lines,note,reference});
 },[initial.type,customer,date,lines,note,reference]);

 // ── Flush latest state on unmount if user navigated or clicked away ──
 useEffect(()=>{
  return()=>{
   if(!savedSuccessfullyRef.current){
    saveDraft(initial.type,latestStateRef.current);
   }
  };
 },[initial.type]);

 // Auto-dismiss the draft-restored notice after 8 seconds
 useEffect(()=>{if(showDraftNotice){const t=setTimeout(()=>setShowDraftNotice(false),8000);return()=>clearTimeout(t);}},[showDraftNotice]);

 function standardRate(itemId:string,onDate=date):string {
  const rate=data.rates.filter((r:RecordData)=>r.item_id===itemId&&r.effective_from<=onDate).at(-1)?.rate;
  return rate==null?'':String(Number(rate));
 }
 const payload={customer_id:customer,date,type:initial.type,note,reference,lines:lines.map(l=>({
  item_id:l.item_id,quantity:l.quantity,damaged_quantity:l.damaged_quantity,
  ...(!isReturn&&l.rental_rate!==''?{rental_rate:Number(l.rental_rate)}:{})
 }))};
 const payloadKey=JSON.stringify(payload);
 const valid=Boolean(customer&&date&&lines.every(l=>l.item_id&&l.quantity>0&&(isReturn||l.rental_rate!=='')));
 useEffect(()=>{
  setPreview(null);setError('');setLoading(false);
  if(!valid) return;
  let cancelled=false;
  const timer=setTimeout(async()=>{
   setLoading(true);
   try{
    await previewFlight.current.catch(()=>{});
    if(cancelled)return;
    const request=previewMovement(JSON.parse(payloadKey));
    previewFlight.current=request;
    const result=await request;
    if(!cancelled)setPreview({...result,payloadKey});
   }
   catch(e){if(!cancelled)setError((e as Error).message);}
   finally{if(!cancelled)setLoading(false);}
  },600);
  return()=>{cancelled=true;clearTimeout(timer);};
 },[payloadKey,valid,retry]);
 function changeLine(index:number,values:Partial<EntryLine>) {
  setLines(current=>current.map((line,i)=>i===index?{...line,...values}:line));
 }
 function changeDate(value:string) {
  setDate(value);
  if(!isReturn) setLines(current=>current.map(l=>l.custom_rate?l:{...l,rental_rate:standardRate(l.item_id,value)}));
 }
 function discardDraft(){
  clearMovementDraft(initial.type);
  setCustomer(initial.customer_id||'');
  setDate(data.today);
  setLines([emptyLine()]);
  setNote('');
  setReference('');
  setShowDraftNotice(false);
 }
 async function handleSave(){
  if(preview?.payloadKey===payloadKey&&!busy){
   savedSuccessfullyRef.current=true;
   try{
    const saved=await onSave(payload);
    if(saved)clearMovementDraft(initial.type);
    else{
     savedSuccessfullyRef.current=false;
     saveDraft(initial.type,{customer,date,lines,note,reference});
    }
   }catch{
    savedSuccessfullyRef.current=false;
    saveDraft(initial.type,{customer,date,lines,note,reference});
   }
  }
 }
 return <form onSubmit={e=>{e.preventDefault();handleSave();}}>
  {showDraftNotice&&<div className="alert success" role="status" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'0.75rem'}}><span>📝 Restored your unsaved {isReturn?'return':'dispatch'} draft.</span><button type="button" className="text-button" onClick={discardDraft} style={{whiteSpace:'nowrap'}}>Discard draft</button></div>}
  <Field label="Delivery / return reference"><input maxLength={80} value={reference} onChange={e=>setReference(e.target.value)} placeholder="Challan or receipt number"/></Field>
  <div className="form-grid">
   <Field label="Customer"><select required value={customer} onChange={e=>setCustomer(e.target.value)}><option value="">Select customer</option>{data.customers.map((c:RecordData)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
   <Field label={isReturn?'Return date':'Dispatch / delivery date'}><input type="date" required max={data.today} value={date} onChange={e=>changeDate(e.target.value)}/></Field>
  </div>
  <div className="form-section">
   <h3>{isReturn?'Material coming back':'Material leaving the yard'}</h3>
   <p>{isReturn?'Returned quantity includes damaged pieces. Rental charges use each original dispatch\'s saved rate.':'The standard rate for the delivery date fills automatically. Change it for this customer\'s dispatch; other customers and existing dispatches keep their own rates.'}</p>
   {lines.map((line,index)=>{
    const standard=standardRate(line.item_id);
    return <div className="dispatch-line-card" key={index}>
     <div className="movement-line">
      <Field label="Item"><select required value={line.item_id} onChange={e=>changeLine(index,{item_id:e.target.value,rental_rate:standardRate(e.target.value),custom_rate:false})}><option value="">Select material</option>{data.items.filter((item:RecordData)=>isReturn||item.active).map((item:RecordData)=><option value={item.id} key={item.id}>{item.name}</option>)}</select></Field>
      <Field label={isReturn?'Total returned':'Quantity'}><input type="number" required min="1" step="1" value={line.quantity} onChange={e=>changeLine(index,{quantity:Number(e.target.value)})}/></Field>
      {isReturn?<Field label="Of which damaged"><input type="number" required min="0" max={line.quantity} step="1" value={line.damaged_quantity} onChange={e=>changeLine(index,{damaged_quantity:Number(e.target.value)})}/></Field>:<Field label="Agreed rent / pc / day (₹)"><input type="number" required min="0" max="99999999" step="0.0001" placeholder="Enter a rental rate" value={line.rental_rate} onChange={e=>changeLine(index,{rental_rate:e.target.value,custom_rate:true})}/></Field>}
      {lines.length>1&&<button type="button" className="icon-button" aria-label="Remove item" onClick={()=>setLines(current=>current.filter((_,i)=>i!==index))}><X size={17}/></button>}
     </div>
     {!isReturn&&line.item_id&&<div className="dispatch-rate-note"><span>{standard===''?'No standard rate on this date. Enter an agreed rate.':`Standard: ${currency(standard)} / piece / day`}{line.custom_rate&&line.rental_rate!==''?' · Customer rate for this dispatch':''}</span>{line.custom_rate&&standard!==''&&<button type="button" className="text-button" onClick={()=>changeLine(index,{rental_rate:standard,custom_rate:false})}>Use standard rate</button>}</div>}
    </div>;
   })}
   <button type="button" className="text-button" onClick={()=>setLines(current=>[...current,emptyLine()])}><Plus size={16}/>Add another item</button>
  </div>
  {error&&<div className="alert error" role="alert">{error}<p>Your entered details are still here. Retry the balance check when the connection is available.</p><button type="button" className="text-button" onClick={()=>setRetry(n=>n+1)}>Retry check</button></div>}
  {loading&&<p className="muted">Checking balances and rates…</p>}
  {preview?.payloadKey===payloadKey&&preview?.previews.map((p:RecordData)=><div className="balance-preview" key={p.item_id}>
   <strong>{p.name}</strong>
   <div>{p.before} at site <ArrowRight size={16}/><b>{p.after} after {isReturn?'return':'dispatch'}</b></div>
   {p.rental_rate!=null&&<small>Agreed rental rate: {currency(p.rental_rate)} per piece per day.</small>}
   {p.lock_until&&<small>This batch is locked until {displayDate(p.lock_until)}.</small>}
   {p.deferred.map((a:RecordData)=><small className="amber-text" key={a.lot_id}>{a.quantity} returned units stay billable until {displayDate(a.billing_date)} at their original dispatch rate.</small>)}
   {Number(p.damage_total)>0&&<small className="amber-text">Damage charge to invoice: {currency(p.damage_total)}</small>}
  </div>)}
  <Field label="Note / challan reference"><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Optional reference or transport details"/></Field>
  <div className="form-footer"><span>{isReturn?'Returns are allocated to the oldest open batches.':'The agreed rate is saved with this dispatch.'}</span><button className="primary" disabled={busy||loading||!preview||preview.payloadKey!==payloadKey}>{busy?'Saving…':isReturn?'Save return':'Save dispatch'}</button></div>
 </form>;
}
