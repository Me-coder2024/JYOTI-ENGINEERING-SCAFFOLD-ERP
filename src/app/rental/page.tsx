import RentalApp from '@/components/rental-app';
import SharedShell from '@/shared/shell';
import {requirePage} from '@/shared/guards';
export const dynamic='force-dynamic';
export default async function RentalWrapper(){const user=await requirePage('rental');return <SharedShell user={user} module="Rental ERP"><RentalApp signedIn={true}/></SharedShell>;}
