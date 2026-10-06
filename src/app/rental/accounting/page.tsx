import {requirePage} from '@/shared/guards';
import SharedShell from '@/shared/shell';
import AccountingApp from '@/rental/accounting-ui';
export const dynamic='force-dynamic';
export const metadata={title:'Rental accounts | Jyoti ERP'};
export default async function Page(){const user=await requirePage('rental');return <SharedShell user={user} module="Rental ERP"><AccountingApp isOwner={user.role==='OWNER'}/></SharedShell>;}
