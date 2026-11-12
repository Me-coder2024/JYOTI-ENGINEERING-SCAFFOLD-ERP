'use client';
import {useEffect,useState} from 'react';
import {defaultChallanFormat,type ChallanFormat} from './challan-format';
export default function ChallanFormatSettings(){
 const [value,setValue]=useState(defaultChallanFormat),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{fetch('/api/rental/accounting/formats').then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);setValue(d.challan||defaultChallanFormat());setReady(true);}).catch(e=>setMessage(e.message));},[]);
 function change(patch:Partial<ChallanFormat>){setValue(v=>({...v,...patch}));setMessage('');}
 return <form onSubmit={async e=>{e.preventDefault();setBusy(true);try{const r=await fetch('/api/rental/accounting/formats',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({module:'challan',settings:value})});const d=await r.json();if(!r.ok)throw Error(d.error);setMessage('Challan format saved. Reopen Print challan to preview it.');}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}}>
 <p>These settings apply only to outward and inward challan PDFs. Invoice and ledger formats stay unchanged.</p>
 <div className="form-grid">
 <label className="field"><span>Challan company heading (optional)</span><input maxLength={100} value={value.heading} onChange={e=>change({heading:e.target.value})} placeholder="Use company name from Settings"/><small>Leave blank to use the configured company name. This does not rename the company on invoices.</small></label>
 <label className="field"><span>Challan layout</span><select value={value.layout} onChange={e=>change({layout:e.target.value as ChallanFormat['layout']})}><option value="reference">Reference format — writing area</option><option value="compact">Compact — totals after items</option></select></label>
 <label className="field"><span>Outward challan title</span><input required maxLength={80} value={value.outward_title} onChange={e=>change({outward_title:e.target.value})}/></label>
 <label className="field"><span>Inward challan title</span><input required maxLength={80} value={value.inward_title} onChange={e=>change({inward_title:e.target.value})}/></label>
 <label className="field"><span>Challan text size</span><input required type="number" min={8} max={11} step={1} value={value.font_size} onChange={e=>change({font_size:Number(e.target.value)})}/></label>
 <label className="field"><span>Challan footer (optional)</span><input maxLength={160} value={value.footer} onChange={e=>change({footer:e.target.value})}/></label>
 <label className="field"><span>Company logo</span><select value={String(value.show_logo)} onChange={e=>change({show_logo:e.target.value==='true'})}><option value="true">Show logo</option><option value="false">Hide logo</option></select></label>
 </div><div className="form-footer"><button type="button" className="secondary" onClick={()=>change(defaultChallanFormat())}>Reset challan format</button><button className="primary" disabled={!ready||busy}>{busy?'Saving…':'Save challan format'}</button></div>{message&&<p role="status">{message}</p>}
 </form>;
}
