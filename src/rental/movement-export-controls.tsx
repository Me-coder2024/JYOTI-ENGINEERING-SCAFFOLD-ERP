'use client';
export default function MovementExportControls({start,end,type,onStart,onEnd,onType,search}:{start:string;end:string;type:string;search:string;onStart:(v:string)=>void;onEnd:(v:string)=>void;onType:(v:string)=>void}){
 const valid=!!start&&!!end&&start<=end;
 const url=(format:string)=>'/api/rental/accounting/movement-export?'+new URLSearchParams({start,end,type,search,format});
 return <div className="a-filters" style={{margin:16}}>
 <label className="field"><span>From</span><input type="date" value={start} onChange={e=>onStart(e.target.value)}/></label>
 <label className="field"><span>To</span><input type="date" value={end} onChange={e=>onEnd(e.target.value)}/></label>
 <label className="field"><span>Movement type</span><select value={type} onChange={e=>onType(e.target.value)}><option value="">Dispatch & return</option><option value="DISPATCH">Dispatch</option><option value="RETURN">Return</option></select></label>
 {valid?<><a className="secondary" target="_blank" rel="noopener noreferrer" href={url('pdf')}>Print / PDF</a><a className="secondary" href={url('xlsx')}>Export Excel</a></>:<p role="alert">Choose a valid date range to export.</p>}
 </div>;
}
