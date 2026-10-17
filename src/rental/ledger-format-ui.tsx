'use client';
import {useEffect,useState} from 'react';
import {defaultFormat,reportColumns,type LedgerFormat,type LedgerModule} from './ledger-formats';
export default function LedgerFormatSettings(){
 const [module,setModule]=useState<LedgerModule>('material'),[formats,setFormats]=useState({material:defaultFormat('material'),party:defaultFormat('party')}),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{fetch('/api/rental/accounting/formats').then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);setFormats(d);setReady(true);}).catch(e=>setMessage(e.message));},[]);
 const value=formats[module];
 function change(patch:Partial<LedgerFormat>){setFormats({...formats,[module]:{...value,...patch}});setMessage('');}
 return <section className="panel" style={{padding:24,marginTop:24}}><h2>Ledger export formats</h2><p>Owner settings apply to future PDF and Excel exports. Transaction data stays unchanged. Use Print / PDF in the selected ledger to preview the saved layout.</p>
 <form onSubmit={async e=>{e.preventDefault();setBusy(true);setMessage('');try{const r=await fetch('/api/rental/accounting/formats',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({module,settings:value})});const d=await r.json();if(!r.ok)throw new Error(d.error);setMessage('Format saved. New exports use this layout.');}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}}>
 <div className="form-grid">
 <label className="field"><span>Ledger format</span><select value={module} onChange={e=>setModule(e.target.value as LedgerModule)}><option value="material">Material ledger</option><option value="party">Party ledger</option></select></label>
 <label className="field"><span>Company heading</span><input required maxLength={100} value={value.heading} onChange={e=>change({heading:e.target.value})}/></label>
 <label className="field"><span>Report title</span><input required maxLength={80} value={value.title} onChange={e=>change({title:e.target.value})}/></label>
 <label className="field"><span>A4 orientation</span><select value={value.orientation} onChange={e=>change({orientation:e.target.value as 'portrait'|'landscape'})}><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label>
 <label className="field"><span>Text size</span><input required type="number" min="7" max="12" step="1" value={value.font_size} onChange={e=>change({font_size:Number(e.target.value)})}/></label>
 <label className="field"><span>Footer (optional)</span><input maxLength={160} value={value.footer} onChange={e=>change({footer:e.target.value})}/></label></div>
 {module==='party'&&<label className="field"><span>Party ledger layout</span><select value={value.layout||'reference'} onChange={e=>change({layout:e.target.value as 'reference'|'table'})}><option value="reference">Reference format - To / By, voucher details, debit / credit</option><option value="table">Custom table with running balance</option></select><small>Column customization below applies to the custom table layout.</small></label>}
 <h3>Column order</h3><p>Date, description and quantity/amount columns are required. Type and reference are optional.</p>
 {value.columns.map((c,i)=><div key={c} className="row-actions" style={{gap:12,marginBottom:8}}><span style={{minWidth:120}}>{c}</span><button type="button" disabled={i===0} onClick={()=>{const cols=[...value.columns];[cols[i-1],cols[i]]=[cols[i],cols[i-1]];change({columns:cols});}}>Move up</button><button type="button" disabled={i===value.columns.length-1} onClick={()=>{const cols=[...value.columns];[cols[i+1],cols[i]]=[cols[i],cols[i+1]];change({columns:cols});}}>Move down</button>{['Vhty','Reference'].includes(c)&&<button type="button" onClick={()=>change({columns:value.columns.filter(v=>v!==c)})}>Hide</button>}</div>)}
 {reportColumns[module].filter(c=>!value.columns.includes(c)).map(c=><button type="button" key={c} onClick={()=>change({columns:[...value.columns,c]})}>Show {c}</button>)}
 <div className="form-footer"><button type="button" className="secondary" onClick={()=>change(defaultFormat(module))}>Reset form to default</button><button className="primary" disabled={busy||!ready}>{busy?'Saving...':'Save export format'}</button></div>{message&&<p role="status">{message}</p>}
 </form></section>;
}
