import ManufacturingApp from '@/manufacturing/app';
import SharedShell from '@/shared/shell';
import {requirePage} from '@/shared/guards';
export const dynamic='force-dynamic';
export const metadata={title:'Manufacturing ERP | Jyoti Engineering'};
export default async function ManufacturingPage(){const user=await requirePage('manufacturing');return <SharedShell user={user} module="Manufacturing ERP"><ManufacturingApp/></SharedShell>;}
