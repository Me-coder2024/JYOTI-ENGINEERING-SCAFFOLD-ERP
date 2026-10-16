'use client';
import type {ReactNode,MouseEvent} from 'react';
import {Layers3,LogOut,Users,ArrowLeftRight} from 'lucide-react';
import type {User} from './access';
import './shared.css';
import './workspace.css';
import {usePathname} from 'next/navigation';
export default function SharedShell({user,module,children}:{user:User;module:string;children:ReactNode}){
 const pathname=usePathname();
 async function signOut(){await fetch('/api/shared/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});window.location.assign('/login');}
 function capture(e:MouseEvent){const button=(e.target as HTMLElement).closest('button[aria-label="Sign out"]');if(button){e.preventDefault();e.stopPropagation();void signOut();}}
 return <div className={module==='Rental ERP'?'erp-wrapper erp-rental-wrapper':'erp-wrapper'} onClickCapture={capture}>
  <header className="erp-global-header"><a href="/rental" className="erp-wordmark"><span className="erp-logo-tile">JE</span><span className="erp-brand-name">JYOTI<small>BUSINESS WORKSPACE</small></span></a><nav className="erp-module-tabs" aria-label="Modules"><a href="/rental" className={pathname==='/rental'?'active':''}>Rental desk</a><a href="/rental/accounting" className={pathname.includes('/accounting')?'active':''}>Accounts & vouchers</a></nav><div className="erp-header-actions"><span className="erp-user"><span className="erp-user-dot"/>{user.name}<small>{user.role==='OWNER'?'Owner':'Team'}</small></span>{user.role==='OWNER'&&<a href="/users" className="erp-team-link"><Users size={15}/>Team</a>}<button onClick={signOut} title="Sign out"><LogOut size={15}/><span>Sign out</span></button></div></header>
  {children}
 </div>;
}
