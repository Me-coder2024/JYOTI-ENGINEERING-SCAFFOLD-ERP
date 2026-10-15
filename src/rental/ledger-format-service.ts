import {pool,transaction} from '@/lib/db';
import {AccessError,type User} from '@/shared/access';
import {defaultFormat,validateFormat,type LedgerModule} from './ledger-formats';
export async function loadFormats(){
 const rows=(await pool.query('SELECT module,settings FROM rental_export_formats')).rows;
 return {material:rows.find(r=>r.module==='material')?.settings||defaultFormat('material'),party:rows.find(r=>r.module==='party')?.settings||defaultFormat('party')};
}
export async function saveFormat(user:User,input:any){
 if(user.role!=='OWNER')throw new AccessError('Only the owner can change export formats.',403);
 if(!['material','party'].includes(input?.module))throw new AccessError('Choose a ledger format.');
 const module=input.module as LedgerModule;
 let settings;try{settings=validateFormat(module,input.settings);}catch(e){throw new AccessError((e as Error).message);}
 return transaction(async db=>{
  const before=(await db.query('SELECT settings FROM rental_export_formats WHERE module=$1',[module])).rows[0]?.settings||defaultFormat(module);
  await db.query('INSERT INTO rental_export_formats(module,settings,updated_by) VALUES($1,$2,$3) ON CONFLICT(module) DO UPDATE SET settings=$2,updated_by=$3,updated_at=now()',[module,JSON.stringify(settings),user.id]);
  await db.query('INSERT INTO erp_audit(user_id,action,entity_id,details) VALUES($1,$2,$3,$4)',[user.id,'LEDGER_FORMAT_SAVE',module,JSON.stringify({before,after:settings})]);
  return {ok:true};
 });
}
