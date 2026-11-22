import {demand} from '@/shared/access';
import {requirePage} from '@/shared/guards';
import SharedShell from '@/shared/shell';
import AccountingApp from '@/rental/accounting-ui';
export const dynamic='force-dynamic';
export const metadata={title:'Rental accounts | Jyoti ERP'};
export default async function Page(){const user=await requirePage('rental');demand(user,'accounts');return <SharedShell user={user} module="Rental ERP"><AccountingApp user={user} isOwner={user.role==='OWNER'}/></SharedShell>;}
