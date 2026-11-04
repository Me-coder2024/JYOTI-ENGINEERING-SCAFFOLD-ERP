import type { Metadata } from 'next';
import './globals.css';
import {DM_Sans,Manrope} from 'next/font/google';
const bodyFont=DM_Sans({subsets:['latin'],display:'swap',variable:'--font-body'});
const headingFont=Manrope({subsets:['latin'],display:'swap',variable:'--font-heading'});
export const metadata: Metadata = {title:'Jyoti Rental Desk | Dispatch & Billing',description:'Scaffolding rental dispatch, returns, daily billing and damage settlement for Jyoti Engineering.'};
export default function Layout({children}:{children:React.ReactNode}) {return <html lang="en" className={`${bodyFont.variable} ${headingFont.variable}`}><body>{children}<div className="snapai-watermark">Powered by <strong>SnapAi</strong></div></body></html>;}
