import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'Jyoti Rental Desk | Dispatch & Billing',description:'Scaffolding rental dispatch, returns, daily billing and damage settlement for Jyoti Engineering.'};
export default function Layout({children}:{children:React.ReactNode}) {return <html lang="en"><body>{children}</body></html>;}
