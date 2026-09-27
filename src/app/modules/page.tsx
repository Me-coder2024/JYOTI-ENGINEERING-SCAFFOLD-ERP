import {requirePage} from '@/shared/guards';
import SharedShell from '@/shared/shell';
import {Boxes,Factory,ArrowUpRight} from 'lucide-react';
export const dynamic='force-dynamic';
export const metadata={title:'Choose workspace | Jyoti ERP'};
export default async function Modules(){const user=await requirePage('owner');return <SharedShell user={user} module="Owner workspace"><main className="erp-chooser"><div className="eyebrow">JYOTI ENGINEERING & SCAFFOLD</div><h1>Choose your workspace</h1><p>Welcome, {user.name}. Where would you like to work today?</p><div className="erp-module-grid"><a href="/rental"><span className="erp-module-icon"><Boxes size={29}/></span><h2>Rental ERP <ArrowUpRight size={23}/></h2><p>Dispatches, returns, rental billing and customer ledgers.</p><span>Open Rental ERP →</span></a><a href="/manufacturing"><span className="erp-module-icon blue"><Factory size={29}/></span><h2>Manufacturing ERP <ArrowUpRight size={23}/></h2><p>Purchases, stock receipts, sales orders and dispatch.</p><span>Open Manufacturing ERP →</span></a></div></main></SharedShell>;}
