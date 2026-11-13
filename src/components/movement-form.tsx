'use client';
import MaterialSearch from './material-search';
import {customerLabel} from '@/rental/customer-identity';
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
async function previewMovement(payload:unknown,signal:AbortSignal) {
 const response=await fetch('/api/movements/preview',{method:'POST',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
 const result=await response.json();
 if(!response.ok) throw new Error(result.error||'Unable to check this entry.');
 return result;
}

/* ── Draft persistence helpers ── */
export const DRAFT_KEY_PREFIX='je_movement_draft_';
export function draftKey(type:string){return DRAFT_KEY_PREFIX+type;}
export interface DraftState{customer:string;date:string;lines:EntryLine[];note:string;reference:string;vehicle?:string;site?:string;savedAt:number;}

export function hasDraftContent(state?:{customer?:string;reference?:string;note?:string;vehicle?:string;lines?:EntryLine[]}):boolean {
 if(!state) return false;
 if(state.vehicle?.trim()) return true;
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
  // Keep unfinished challans until explicitly discarded or successfully saved.
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

type MovementProps={data:RecordData;initial:RecordData;busy:boolean;onSave:(value:RecordData)=>Promise<boolean>;renderCreate?:(kind:string,done:(id:string)=>void)=>ReactNode};
export function listMovementDrafts(type:string){
 const drafts:{slot:string;draft:DraftState}[]=[];
 if(typeof window==='undefined')return drafts;
 try{for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key&&(key===draftKey(type)||key.startsWith(draftKey(type)+':'))){const slot=key.slice(DRAFT_KEY_PREFIX.length),draft=loadDraft(slot);if(draft)drafts.push({slot,draft});}}}catch{}
 return drafts.sort((a,b)=>b.draft.savedAt-a.draft.savedAt);
}
export default function MovementForm(props:MovementProps){
 const [drafts,setDrafts]=useState(()=>listMovementDrafts(props.initial.type));
 const [slot,setSlot]=useState(()=>drafts[0]?.slot||props.initial.type+':'+crypto.randomUUID());
 const [showDrafts,setShowDrafts]=useState(false);
 const refresh=()=>setDrafts(listMovementDrafts(props.initial.type));
 return <><section className="form-section" aria-label="Challan drafts"><div className="row-actions" style={{display:'flex',flexWrap:'wrap',gap:12}}><button type="button" className="secondary" disabled={props.busy} onClick={()=>{refresh();setSlot(props.initial.type+':'+crypto.randomUUID());setShowDrafts(false);}}>Start new challan</button><button type="button" className="secondary" disabled={props.busy} onClick={()=>{refresh();setShowDrafts(v=>!v);}}>Saved challan drafts</button></div><p>Starting a new challan keeps your unfinished drafts on this browser. Saving one challan removes only its own draft.</p>{showDrafts&&<div>{drafts.length?drafts.map(({slot:id,draft})=><div key={id} className="row-actions" style={{display:'flex',gap:12,alignItems:'center',marginTop:12}}><span style={{flex:1}}>{draft.reference||'Unnumbered challan'} · {props.data.customers.find((c:RecordData)=>c.id===draft.customer)?.name||'Customer not selected'} · {draft.site||'Legacy / Unassigned'}<small> {new Date(draft.savedAt).toLocaleString()}</small></span><button type="button" className="secondary" disabled={props.busy} onClick={()=>{setSlot(id);setShowDrafts(false);}}>Continue draft</button></div>):<p>No saved drafts.</p>}</div>}</section><MovementEditor key={slot} {...props} draftSlot={slot}/></>;
}
function MovementEditor({data,initial,busy,onSave,renderCreate,draftSlot}:{data:RecordData;initial:RecordData;busy:boolean;onSave:(value:RecordData)=>Promise<boolean>;renderCreate?:(kind:string,done:(id:string)=>void)=>ReactNode;draftSlot:string}) {
 const isReturn=initial.type==='RETURN';

 // ── Restore draft on mount ──
 const draft=useRef(loadDraft(draftSlot));
 const hasDraft=draft.current!==null;
 const restored=draft.current;

 const [customer,setCustomer]=useState(restored?.customer||initial.customer_id||'');
 const [site,setSite]=useState(restored?.site||'');
 const sites:string[]=data.customers.find((c:RecordData)=>c.id===customer)?.sites||[];
 const legacyStock=isReturn&&data.movements.some((m:RecordData)=>m.customer_id===customer&&!m.site_name);
 const [date,setDate]=useState<string>(restored?.date||data.today);
 const [lines,setLines]=useState<EntryLine[]>(restored?.lines?.length?restored.lines:[emptyLine()]);
 const [note,setNote]=useState(restored?.note||'');
 const [reference,setReference]=useState(restored?.reference||'');
 const [vehicle,setVehicle]=useState(restored?.vehicle||'');
 const [creating,setCreating]=useState('');
 const createItemRow=useRef<number|null>(null);
 const [preview,setPreview]=useState<RecordData|null>(null);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(false);
 const [retry,setRetry]=useState(0);
 const [showDraftNotice,setShowDraftNotice]=useState(hasDraft);

 const savedSuccessfullyRef=useRef(false);
 const latestStateRef=useRef({customer,date,lines,note,reference,vehicle,site});
 latestStateRef.current={customer,date,lines,note,reference,vehicle,site};

 // ── Auto-save draft on every change ──
 useEffect(()=>{
  if(savedSuccessfullyRef.current) return;
  saveDraft(draftSlot,{customer,date,lines,note,reference,vehicle,site});
 },[initial.type,customer,date,lines,note,reference,vehicle,site]);

 // ── Flush latest state on unmount if user navigated or clicked away ──
 useEffect(()=>{
  return()=>{
   if(!savedSuccessfullyRef.current){
    saveDraft(draftSlot,latestStateRef.current);
   }
  };
 },[initial.type]);

 // Auto-dismiss the draft-restored notice after 8 seconds
 useEffect(()=>{if(showDraftNotice){const t=setTimeout(()=>setShowDraftNotice(false),8000);return()=>clearTimeout(t);}},[showDraftNotice]);

 function standardRate(itemId:string,onDate=date):string {
  const rate=data.rates.filter((r:RecordData)=>r.item_id===itemId&&r.effective_from<=onDate).at(-1)?.rate;
  return rate==null?'':String(Number(rate));
 }
 useEffect(()=>{setLines(current=>current.map(l=>l.item_id&&l.rental_rate===''&&!l.custom_rate?{...l,rental_rate:standardRate(l.item_id)}:l));},[data.rates]);
 const payload={site_name:site==='__legacy__'?'':site,legacy_site:site==='__legacy__',customer_id:customer,date,type:initial.type,note,reference,vehicle_no:vehicle,lines:lines.map(l=>({
  item_id:l.item_id,quantity:l.quantity,damaged_quantity:l.damaged_quantity,
  ...(!isReturn&&l.rental_rate!==''?{rental_rate:Number(l.rental_rate)}:{})
 }))};
 const payloadKey=JSON.stringify({customer_id:customer,site_name:payload.site_name,legacy_site:payload.legacy_site,date,type:initial.type,lines:payload.lines});
 const valid=Boolean(customer&&(!sites.length||sites.includes(site)||(legacyStock&&site==='__legacy__'))&&date&&lines.every(l=>l.item_id&&l.quantity>0&&(isReturn||l.rental_rate!=='')));
 useEffect(()=>{
  setPreview(null);setError('');setLoading(false);
  if(!valid) return;
  let cancelled=false;
  const controller=new AbortController();
  const timer=setTimeout(async()=>{
   setLoading(true);
   try{
    const result=await previewMovement(JSON.parse(payloadKey),AbortSignal.any([controller.signal,AbortSignal.timeout(20000)]));
    if(!cancelled)setPreview({...result,payloadKey});
   }
   catch(e){if(!cancelled)setError((e as Error).message);}
   finally{if(!cancelled)setLoading(false);}
  },600);
  return()=>{cancelled=true;clearTimeout(timer);controller.abort();};
 },[payloadKey,valid,retry]);
 function changeLine(index:number,values:Partial<EntryLine>) {
  setLines(current=>current.map((line,i)=>i===index?{...line,...values}:line));
 }
 function changeDate(value:string) {
  setDate(value);
  if(!isReturn) setLines(current=>current.map(l=>l.custom_rate?l:{...l,rental_rate:standardRate(l.item_id,value)}));
 }
 function discardDraft(){
  if(!window.confirm('Discard this challan draft? Other drafts will be kept.'))return;
  clearMovementDraft(draftSlot);
  setCustomer(initial.customer_id||'');setSite('');
  setDate(data.today);
  setLines([emptyLine()]);
  setNote('');
  setReference('');setVehicle('');
  setShowDraftNotice(false);
 }
 async function handleSave(){
  if(preview?.payloadKey===payloadKey&&!busy){
   savedSuccessfullyRef.current=true;
   try{
    const saved=await onSave(payload);
    if(saved)clearMovementDraft(draftSlot);
    else{
     savedSuccessfullyRef.current=false;
     saveDraft(draftSlot,{customer,date,lines,note,reference,vehicle,site});
    }
   }catch{
    savedSuccessfullyRef.current=false;
    saveDraft(draftSlot,{customer,date,lines,note,reference,vehicle,site});
   }
  }
 }
 return <>{creating&&renderCreate&&<section className="form-section"><h3>Create {creating}</h3><button type="button" className="secondary" onClick={()=>setCreating('')}>Back to challan</button>{renderCreate(creating,id=>{if(creating==='customer'){setCustomer(id);setSite('');}else setLines(current=>{const blank=createItemRow.current??current.findIndex(l=>!l.item_id);return blank>=0?current.map((l,i)=>i===blank?{...l,item_id:id,rental_rate:standardRate(id)}:l):[...current,{...emptyLine(),item_id:id,rental_rate:standardRate(id)}];});setCreating('');})}</section>}<form style={{display:creating?'none':undefined}} onSubmit={e=>{e.preventDefault();handleSave();}}>
  {showDraftNotice&&<div className="alert success" role="status" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'0.75rem'}}><span>📝 Restored your unsaved {isReturn?'inward challan':'outward challan'} draft.</span><button type="button" className="text-button" onClick={discardDraft} style={{whiteSpace:'nowrap'}}>Discard draft</button></div>}
  <Field label="Challan number"><input maxLength={80} value={reference} onChange={e=>setReference(e.target.value)} placeholder="Leave blank to generate a challan number"/></Field><Field label="Vehicle number (optional)"><input maxLength={40} value={vehicle} onChange={e=>setVehicle(e.target.value)}/></Field>
  <div className="form-grid">
   <Field label="Customer"><select required value={customer} onChange={e=>{setCustomer(e.target.value);setSite('');}}><option value="">Select customer</option>{data.customers.map((c:RecordData)=><option key={c.id} value={c.id}>{customerLabel(c)}</option>)}</select></Field>
   {sites.length>0&&<Field label={isReturn?'From site':'To site'}><select required value={site} onChange={e=>setSite(e.target.value)}><option value="">Select site</option>{sites.map(s=><option key={s} value={s}>{s}</option>)}{legacyStock&&<option value="__legacy__">Existing stock — site not recorded</option>}</select></Field>}
   <Field label={isReturn?'Inward challan date':'Outward challan date'}><input type="date" required max={data.today} value={date} onChange={e=>changeDate(e.target.value)}/></Field>
  </div>
  {!isReturn&&renderCreate&&<div className="form-footer"><button type="button" className="secondary" onClick={()=>setCreating('customer')}>+ New customer</button><button type="button" className="secondary" onClick={()=>{createItemRow.current=null;setCreating('item');}}>+ New item</button></div>}
  <div className="form-section">
   <h3>{isReturn?'Material coming back':'Material leaving the yard'}</h3>
   <p>{isReturn?'Returned quantity includes damaged pieces. Rental charges use each original dispatch\'s saved rate.':'The standard rate for the delivery date fills automatically. Change it for this customer\'s dispatch; other customers and existing dispatches keep their own rates.'}</p>
   {lines.map((line,index)=>{
    const standard=standardRate(line.item_id);
    return <div className="dispatch-line-card" key={index}>
     <div className="movement-line">
      <MaterialSearch items={data.items.filter((item:RecordData)=>isReturn||item.active)} value={line.item_id} onChange={id=>changeLine(index,{item_id:id,rental_rate:standardRate(id),custom_rate:false})} onCreate={renderCreate?()=>{createItemRow.current=index;setCreating('item');}:undefined}/>
      <Field label={isReturn?'Total returned':'Quantity'}><input type="number" required min="1" step="1" value={line.quantity} onChange={e=>changeLine(index,{quantity:Number(e.target.value)})}/></Field>
      {isReturn?<Field label="Of which damaged"><input type="number" required min="0" max={line.quantity} step="1" value={line.damaged_quantity} onChange={e=>changeLine(index,{damaged_quantity:Number(e.target.value)})}/></Field>:<Field label="Agreed rent / pc / day (₹)"><input type="number" required min="0" max="99999999" step="0.0001" placeholder="Enter a rental rate" value={line.rental_rate} onChange={e=>changeLine(index,{rental_rate:e.target.value,custom_rate:true})}/></Field>}
      {lines.length>1&&<button type="button" className="icon-button" aria-label="Remove item" onClick={()=>setLines(current=>current.filter((_,i)=>i!==index))}><X size={17}/></button>}
     </div>
     {!isReturn&&line.item_id&&<div className="dispatch-rate-note"><span>{standard===''?'No standard rate on this date. Enter an agreed rate.':`Standard: ${currency(standard)} / piece / day`}{line.custom_rate&&line.rental_rate!==''?' · Customer rate for this dispatch':''}</span>{line.custom_rate&&standard!==''&&<button type="button" className="text-button" onClick={()=>changeLine(index,{rental_rate:standard,custom_rate:false})}>Use standard rate</button>}</div>}
    </div>;
   })}
   <button type="button" className="text-button" onClick={()=>setLines(current=>[...current,emptyLine()])}><Plus size={16}/>Add another item</button>
  </div>
  {error&&<div className="alert error" role="alert">{error}<p>Your entered details are still here. Review the message above, correct the entry if needed, then retry the check.</p><button type="button" className="text-button" onClick={()=>setRetry(n=>n+1)}>Retry check</button></div>}
  {loading&&<p className="muted">Checking balances and rates…</p>}
  {preview?.payloadKey===payloadKey&&preview?.previews.map((p:RecordData)=><div className="balance-preview" key={p.item_id}>
   <strong>{p.name}</strong>
   <div>{p.before} at site <ArrowRight size={16}/><b>{p.after} after {isReturn?'inward challan':'outward challan'}</b></div>
   {p.rental_rate!=null&&<small>Agreed rental rate: {currency(p.rental_rate)} per piece per day.</small>}
   {p.lock_until&&<small>This batch is locked until {displayDate(p.lock_until)}.</small>}
   {p.deferred.map((a:RecordData)=><small className="amber-text" key={a.lot_id}>{a.quantity} returned units stop billing from {displayDate(a.billing_date)} (return day included) at their original dispatch rate.</small>)}
   {Number(p.damage_total)>0&&<small className="amber-text">Damage charge to invoice: {currency(p.damage_total)}</small>}
  </div>)}
  <Field label="Note / challan reference"><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Optional reference or transport details"/></Field>
  <div className="form-footer"><span>{isReturn?'Returns are allocated to the oldest open batches.':'The agreed rate is saved with this dispatch.'}</span><button className="primary" disabled={busy||loading||!preview||preview.payloadKey!==payloadKey}>{busy?'Saving…':isReturn?'Save inward challan':'Save outward challan'}</button></div>
 </form></>;
}
