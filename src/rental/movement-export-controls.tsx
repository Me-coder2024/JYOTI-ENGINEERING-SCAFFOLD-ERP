'use client';
import {customerLabel} from '@/rental/customer-identity';
export default function MovementExportControls({start,end,type,onStart,onEnd,onType,search,customer,challan,customers,onCustomer,onChallan}:{customer:string;challan:string;customers:any[];onCustomer:(v:string)=>void;onChallan:(v:string)=>void;start:string;end:string;type:string;search:string;onStart:(v:string)=>void;onEnd:(v:string)=>void;onType:(v:string)=>void}){
 const valid=!!start&&!!end&&start<=end;
 const url=(format:string)=>'/api/rental/accounting/movement-export?'+new URLSearchParams({start,end,type,search,customer,challan,format});
 return <div className="report-filters">
 <label className="field"><span>From</span><input type="date" value={start} onChange={e=>onStart(e.target.value)}/></label>
 <label className="field"><span>To</span><input type="date" value={end} onChange={e=>onEnd(e.target.value)}/></label>
 <label className="field"><span>Movement type</span><select value={type} onChange={e=>onType(e.target.value)}><option value="">Dispatch & return</option><option value="DISPATCH">Dispatch</option><option value="RETURN">Return</option></select></label>
 <label className="field"><span>Customer</span><select value={customer} onChange={e=>onCustomer(e.target.value)}><option value="">All customers</option>{customers.map(c=><option key={c.id} value={c.id}>{customerLabel(c)}</option>)}</select></label>
 <label className="field"><span>Challan number</span><input value={challan} onChange={e=>onChallan(e.target.value)} placeholder="Search challan number"/></label>
 <div className="report-filter-actions">{valid?<><a className="secondary" target="_blank" rel="noopener noreferrer" href={url('pdf')}>Print / PDF</a><a className="secondary" href={url('xlsx')}>Export Excel</a></>:<p role="alert">Choose a valid date range to export.</p>}</div>
 </div>;
}
