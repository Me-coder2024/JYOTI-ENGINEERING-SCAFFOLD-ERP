import {requirePage} from '@/shared/guards';
import SharedShell from '@/shared/shell';
import UsersPanel from '@/shared/users-panel';
export const dynamic='force-dynamic';
export const metadata={title:'Team access | Jyoti ERP'};
export default async function UsersPage(){const user=await requirePage('owner');return <SharedShell user={user} module="Team access"><UsersPanel/></SharedShell>;}
