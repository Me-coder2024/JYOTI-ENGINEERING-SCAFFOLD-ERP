'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,ArrowDownLeft,Building2,ChevronRight,FileText,PackageCheck,Truck,Users,Wallet,Boxes,Settings} from 'lucide-react';
type Row=Record<string,any>;
export default function RentalGateway({data,onNavigate,onCreate}:{data:Row;onNavigate:(view:string)=>void;onCreate:(kind:string,record?:Row)=>void}){
 const menuRef=useRef<HTMLElement>(null);
 const [selected,setSelected]=useState('New dispatch');
 useEffect(()=>{
  const handleKey=(event:KeyboardEvent)=>{
   if(event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
   if(!['ArrowUp','ArrowDown','Enter'].includes(event.key))return;
   if(document.querySelector('[role="dialog"],[aria-modal="true"]'))return;
   const target=event.target instanceof Element?event.target:null;
   const menu=menuRef.current;
   if(!menu||target?.closest('input,textarea,select,[contenteditable="true"]'))return;
   if(target?.closest('button,a,[role="button"]')&&!menu.contains(target))return;
   const commands=Array.from(menu.querySelectorAll<HTMLElement>('.gateway-command'));
   const current=commands.findIndex(command=>command.dataset.command===selected);
   if(event.key==='Enter'){
    if(menu.contains(target))return;
    event.preventDefault();
    commands[current]?.click();
    return;
   }
   event.preventDefault();
   const next=(current+(event.key==='ArrowDown'?1:-1)+commands.length)%commands.length;
   commands[next]?.focus();
  };
  document.addEventListener('keydown',handleKey);
  return()=>document.removeEventListener('keydown',handleKey);
 },[selected]);
 const quantity=data.balances.reduce((n:number,b:Row)=>n+b.physical,0);
 const onHire=data.balances.reduce((n:number,b:Row)=>n+b.physical*Number(data.items.find((i:Row)=>i.id===b.item_id)?.material_value||0),0);
 const committed=data.balances.reduce((n:number,b:Row)=>n+b.billable-b.physical,0);
 const active=new Set(data.balances.filter((b:Row)=>b.physical>0).map((b:Row)=>b.customer_id)).size;
 const pending=data.invoices.filter((i:Row)=>i.status==='FINAL').reduce((n:number,i:Row)=>n+Number(i.outstanding||0),0);
 const amount=(n:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n);
 const menus=[
  {label:'MASTERS',items:[{label:'Customers',detail:'Party profiles',icon:Users,run:()=>onNavigate('Customers')},{label:'Item master',detail:'Materials & rates',icon:Boxes,run:()=>onNavigate('Item Master')},{label:'Chart of accounts',detail:'Ledgers & groups',icon:Wallet,href:'/rental/accounting?view=ledgers'}]},
  {label:'TRANSACTIONS',items:[{label:'New dispatch',detail:'Material outward',icon:ArrowUpRight,run:()=>onCreate('movement',{type:'DISPATCH'}),primary:true},{label:'Record return',detail:'Material inward',icon:ArrowDownLeft,run:()=>onCreate('movement',{type:'RETURN'})},{label:'Payment / receipt',detail:'Accounting vouchers',icon:Wallet,href:'/rental/accounting?view=daybook&create=receipt'},{label:'Generate invoice',detail:'Rental billing',icon:FileText,run:()=>onCreate('invoice')}]},
  {label:'REPORTS',items:[{label:'Material ledger',detail:'Issued, received & pending',icon:PackageCheck,run:()=>onNavigate('Customer Ledger')},{label:'Party ledger',detail:'Payments & balances',icon:FileText,href:'/rental/accounting?view=ledger'},{label:'Dispatch & returns',detail:'Movement history',icon:Truck,run:()=>onNavigate('Dispatch & Returns')}]}
 ];
 return <>
 <div className="gateway-layout">
 <section className="gateway-company">
  <div className="gateway-section-label"><Building2 size={15}/> ACTIVE COMPANY</div>
  <div className="gateway-company-mark">JE</div>
  <h2>{data.company.name?.trim()||'Set up your company'}</h2><p>Rental operations & accounting</p>
  <dl><div><dt>Working date</dt><dd>{new Date(data.today+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})}</dd></div><div><dt>Registered customers</dt><dd>{data.customers.length}</dd></div><div><dt>Material catalog</dt><dd>{data.items.length} items</dd></div></dl>
  <button className="text-button" onClick={()=>onNavigate('Settings')}><Settings size={14}/>Company & document settings<ChevronRight size={14}/></button>
  <div className="gateway-note"><span className="gateway-note-dot"/><div><strong>One connected workspace</strong><p>Dispatches, returns, billing and accounts, together.</p></div></div>
 </section>
 <section className="gateway-menu" ref={menuRef} aria-label="Gateway of Jyoti"><div className="gateway-menu-title"><span>Gateway of Jyoti</span><small>Up / Down: select · Enter: open</small></div>
 <div className="gateway-menu-body">{menus.map(group=><div className="gateway-menu-group" key={group.label}><h3>{group.label}</h3>{group.items.map(item=>{const Icon=item.icon;const content=<><Icon size={16}/><span>{item.label}<small>{item.detail}</small></span><ChevronRight size={14}/></>;return 'href' in item?<a href={item.href} className={'gateway-command '+(selected===item.label?'selected':'')} data-command={item.label} onFocus={()=>setSelected(item.label)} key={item.label}>{content}</a>:<button key={item.label} data-command={item.label} onFocus={()=>setSelected(item.label)} className={'gateway-command '+(selected===item.label?'selected':'')} onClick={item.run}>{content}</button>;})}</div>)}</div></section>
 <aside className="gateway-desk"><div className="gateway-section-label">YOUR DESK</div><h2>A clearer view<br/>of every movement.</h2><p>Start with a dispatch, record a return, or review a customer account.</p>
 <div className="gateway-desk-card"><span className="gateway-desk-icon"><FileText size={22}/></span><strong>Ready to bill?</strong><p>Review daily rental and damage charges before finalizing.</p><button onClick={()=>onCreate('invoice')}>Prepare invoice <ArrowUpRight size={16}/></button></div>
 <a className="gateway-quotation" href="#" onClick={e=>{e.preventDefault();onNavigate('Quotations');}}><FileText size={18}/><span>Rental quotations<small>Prepare your next offer</small></span><ChevronRight size={15}/></a>
 </aside></div>
 <div className="gateway-stats">
 {[{label:'Material at site',value:quantity.toLocaleString('en-IN'),suffix:'pieces',icon:Boxes},{label:'Active customer sites',value:String(active),suffix:'customers',icon:Users},{label:'Final invoice outstanding',value:amount(pending),suffix:'after allocated receipts',icon:Wallet},{label:'Material value on hire',value:amount(onHire),suffix:'saved replacement values',icon:Truck},{label:'In minimum commitment',value:committed.toLocaleString('en-IN'),suffix:'returned pieces still billable',icon:PackageCheck},{label:'Movement entries',value:String(data.movements.length),suffix:'dispatches & returns',icon:Truck}].map(({label,value,suffix,icon:Icon})=><section key={label}><span className="gateway-stat-icon"><Icon size={18}/></span><div><p>{label}</p><strong>{value}</strong><small>{suffix}</small></div></section>)}
 </div>
 </>;
}
