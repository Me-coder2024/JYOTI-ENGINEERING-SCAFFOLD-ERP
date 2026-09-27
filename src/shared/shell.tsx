'use client';
import type {ReactNode,MouseEvent} from 'react';
import {Layers3,LogOut,Users,ArrowLeftRight} from 'lucide-react';
import type {User} from './access';
import './shared.css';
export default function SharedShell({user,module,children}:{user:User;module:string;children:ReactNode}){
 async function signOut(){await fetch('/api/shared/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});window.location.assign('/login');}
 function capture(e:MouseEvent){const button=(e.target as HTMLElement).closest('button[aria-label="Sign out"]');if(button){e.preventDefault();e.stopPropagation();void signOut();}}
 return <div className={module==='Rental ERP'?'erp-wrapper erp-rental-wrapper':'erp-wrapper'} onClickCapture={capture}>
  <header className="erp-global-header"><a href={user.role==='OWNER'?'/modules':user.role==='RENTAL_STAFF'?'/rental':'/manufacturing'} className="erp-wordmark"><Layers3 size={19}/>JYOTI <span>{module}</span></a><div><span className="erp-user">{user.name}</span>{user.role==='OWNER'&&<><a href="/users"><Users size={15}/>Team access</a><a href="/modules"><ArrowLeftRight size={15}/>Switch Module</a></>}<button onClick={signOut}><LogOut size={15}/>Sign out</button></div></header>
  {children}
 </div>;
}
