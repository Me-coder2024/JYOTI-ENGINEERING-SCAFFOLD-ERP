'use client';
import {useId,useState} from 'react';
type Option={id:string;name:string};
export default function SearchSelect({value,onChange,options,required=false}:{value:string;onChange:(id:string)=>void;options:Option[];required?:boolean}){
 const id=useId(),[query,setQuery]=useState(''),[open,setOpen]=useState(false),[active,setActive]=useState(0);
 const selected=options.find(o=>o.id===value);
 const matches=options.filter(o=>o.name.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>Number(b.name.toLowerCase().startsWith(query.toLowerCase()))-Number(a.name.toLowerCase().startsWith(query.toLowerCase())));
 function choose(o:Option){onChange(o.id);setQuery('');setOpen(false);setActive(0);}
 return <div style={{position:'relative'}}><input role="combobox" aria-expanded={open} aria-controls={id} aria-autocomplete="list" aria-activedescendant={open&&matches[active]?id+'-'+active:undefined} required={required} value={open?query:selected?.name||''} placeholder="Type to search…" onFocus={()=>{setQuery('');setOpen(true);setActive(0);}} onBlur={()=>setOpen(false)} onChange={e=>{setQuery(e.target.value);onChange('');setActive(0);setOpen(true);}} onKeyDown={e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setOpen(true);setActive(n=>Math.max(0,Math.min(matches.length-1,n+(e.key==='ArrowDown'?1:-1))));}if(e.key==='Enter'&&open){e.preventDefault();if(matches[active])choose(matches[active]);}if(e.key==='Escape'){e.preventDefault();setOpen(false);}}}/>{open&&<div id={id} role="listbox" style={{position:'absolute',zIndex:30,background:'white',border:'1px solid #cad5d0',maxHeight:220,overflow:'auto',width:'100%',boxShadow:'0 6px 20px #0002'}}>{matches.map((o,i)=><div id={id+'-'+i} key={o.id} role="option" aria-selected={i===active} onMouseDown={e=>{e.preventDefault();choose(o);}} style={{padding:10,background:i===active?'#e3f3ec':'white',cursor:'pointer'}}>{o.name}</div>)}{!matches.length&&<div style={{padding:10}}>No matches</div>}</div>}</div>;
}
