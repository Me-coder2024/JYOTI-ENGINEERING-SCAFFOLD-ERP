import { authenticated } from '@/lib/auth';
import RentalApp from '@/components/rental-app';
export const dynamic='force-dynamic';
export default async function Page() {return <RentalApp signedIn={await authenticated()}/>;}
