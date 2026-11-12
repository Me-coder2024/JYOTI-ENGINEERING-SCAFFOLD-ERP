'use client';
import {useState} from 'react';
export default function CustomerSites({initial=[]}:{initial?:string[]}){
 const [sites,setSites]=useState(initial);
 return <section className="form-section span-2"><h3>Sites (optional)</h3><p>Add the customer's work sites. Leave this empty if site tracking is not needed. Sites used by existing challans must be retained.</p><input type="hidden" name="sites_json" value={JSON.stringify(sites.map(s=>s.trim()).filter(Boolean))}/>{sites.map((site,i)=><div className="row-actions" key={i} style={{display:'flex',gap:12,marginBottom:12}}><label className="field" style={{flex:1,margin:0}}><span>Site {i+1}</span><input maxLength={200} value={site} onChange={e=>setSites(v=>v.map((s,n)=>n===i?e.target.value:s))} placeholder="Site name / location"/></label><button type="button" className="secondary" aria-label={'Remove site '+(i+1)} onClick={()=>setSites(v=>v.filter((_,n)=>n!==i))}>Remove</button></div>)}<button type="button" className="secondary" onClick={()=>setSites(v=>[...v,''])}>+ Add site</button></section>;
}
