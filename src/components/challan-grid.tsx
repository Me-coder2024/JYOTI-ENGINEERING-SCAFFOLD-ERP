'use client';
import {useRef,useState,type ReactNode} from 'react';
import {ArrowLeft,ArrowRight,Building2,CalendarDays,MapPin,Search,Users,X} from 'lucide-react';
import {groupChallans} from '@/rental/challan-groups';
import {customerLabel,customerSearchText} from '@/rental/customer-identity';

type Row=Record<string,any>;
export default function ChallanGrid({customers,movements,renderTable}:{customers:Row[];movements:Row[];renderTable:(rows:Row[])=>ReactNode}){
 const [customerId,setCustomerId]=useState(''),[site,setSite]=useState<string|null>(null),[search,setSearch]=useState(''),[date,setDate]=useState('');
 const dateInput=useRef<HTMLInputElement>(null);
 const customer=customers.find(c=>c.id===customerId);
 const customerRows=movements.filter(m=>m.customer_id===customerId);
 const sites:string[]=customer?.sites||[];
 const choosingSite=!!customer&&sites.length>0&&site===null;
 const showingChallans=!!customer&&!choosingSite;
 const query=search.trim().toLowerCase();
 const scoped=customerRows.filter(m=>(site===null||(m.site_name||'')===site)&&(!date||m.date===date));
 const rows=groupChallans(scoped).filter(g=>g.some(m=>(m.reference||'').toLowerCase().includes(query))).flat().sort((a,b)=>b.date.localeCompare(a.date));
 function resetSearch(){setSearch('');setDate('');}
 function back(){if(showingChallans&&sites.length){setSite(null);}else{setCustomerId('');setSite(null);}resetSearch();}
 const counts=new Map<string,number>();
 for(const group of groupChallans(movements)){const id=group[0].customer_id;counts.set(id,(counts.get(id)||0)+1);}
 return <section className="panel challan-browser">
  <div className="challan-browser-heading">
   <div className="challan-breadcrumb">{customer&&<button type="button" className="secondary" onClick={back}><ArrowLeft size={16}/>Back</button>}<div><h2>{customer?customerLabel(customer):'Customer challans'}</h2><p>{!customer?'Choose a customer to browse their challans.':choosingSite?'Choose a site to see its outward and inward challans.':site===null?'All outward and inward challans':site||'Existing stock — site not recorded'}</p></div></div>
   {showingChallans&&<div className="challan-calendar"><button type="button" className="secondary" aria-label="Choose challan date" onClick={()=>{dateInput.current?.focus();try{dateInput.current?.showPicker();}catch{/* Native date input remains usable. */}}}><CalendarDays size={18}/><span>Date</span></button><input ref={dateInput} type="date" aria-label="Challan date" value={date} onChange={e=>setDate(e.target.value)}/>{date&&<button type="button" className="icon-button" aria-label="Clear challan date" onClick={()=>setDate('')}><X size={18}/></button>}</div>}
  </div>
  <form className="challan-grid-search" role="search" onSubmit={e=>e.preventDefault()}><label><Search size={18}/><input aria-label={customer?choosingSite?'Search sites':'Search challans':'Search customers'} value={search} onChange={e=>setSearch(e.target.value)} placeholder={customer?choosingSite?'Search sites…':'Search challan number…':'Search customer name, GSTIN or contact…'}/></label><button type="submit" className="secondary">Search</button></form>
  {!customer?<div className="challan-card-grid">{customers.filter(c=>customerSearchText(c).toLowerCase().includes(query)).map(c=><button type="button" className="challan-browser-card" key={c.id} onClick={()=>{setCustomerId(c.id);setSite(null);resetSearch();}}><span className="challan-card-icon"><Users size={22}/></span><strong>{customerLabel(c)}</strong><span>{(c.sites||[]).length?`${c.sites.length} sites`:'All challans'}</span><span className="challan-card-footer">{counts.get(c.id)||0} challans<ArrowRight size={17}/></span></button>)}</div>:choosingSite?<div className="challan-card-grid">{[...sites,...(customerRows.some(m=>!m.site_name)?['']:[])].filter(s=>(s||'Existing stock site not recorded').toLowerCase().includes(query)).map(s=><button type="button" className="challan-browser-card" key={s} onClick={()=>{setSite(s);resetSearch();}}><span className="challan-card-icon"><MapPin size={22}/></span><strong>{s||'Site not recorded'}</strong><span>{s?'Customer site':'Historical unassigned stock'}</span><span className="challan-card-footer">{groupChallans(customerRows.filter(m=>(m.site_name||'')===s)).length} challans<ArrowRight size={17}/></span></button>)}</div>:<><div className="challan-grid-count">{groupChallans(rows).length} challans{date?` · ${date}`:' · All dates'}</div>{rows.length?renderTable(rows):<div className="challan-grid-empty"><CalendarDays size={28}/><h3>No challans found</h3><p>Try another date or clear the search.</p></div>}</>}
  {!customer&&!customers.some(c=>customerSearchText(c).toLowerCase().includes(query))&&<div className="challan-grid-empty"><Building2 size={28}/><h3>No customers found</h3><p>Try a different customer name.</p></div>}
  {choosingSite&&![...sites,...(customerRows.some(m=>!m.site_name)?['']:[])].some(s=>(s||'Existing stock site not recorded').toLowerCase().includes(query))&&<div className="challan-grid-empty">No sites match your search.</div>}
 </section>;
}
