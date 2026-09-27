import {requirePage} from '@/shared/guards';
import SharedShell from '@/shared/shell';
import AccountingApp from '@/manufacturing/accounting-ui';
export const dynamic='force-dynamic';
export const metadata={title:'Manufacturing accounts | Jyoti ERP'};
export default async function Page(){const user=await requirePage('manufacturing');return <SharedShell user={user} module="Manufacturing ERP"><AccountingApp isOwner={user.role==='OWNER'}/></SharedShell>;}
