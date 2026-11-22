import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {transaction} from '@/lib/db';
import {moduleActions,canManageUsers,AccessError,type User} from './access';
const actions=z.object({view:z.boolean().optional(),create:z.boolean().optional(),edit:z.boolean().optional(),delete:z.boolean().optional()}).strict();
export const permissionSchema=z.object(Object.fromEntries(Object.keys(moduleActions).map(k=>[k,actions.optional()]))).strict();
export async function saveRole(actor:User,input:unknown){
 if(!canManageUsers(actor))throw new AccessError('User administration required.',403);
 const d=z.object({id:z.string().uuid().optional(),name:z.string().trim().min(1).max(100),permissions:permissionSchema}).parse(input);
 return transaction(async db=>{
  const id=d.id||randomUUID();
  await db.query('INSERT INTO erp_roles(id,name,permissions) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET name=$2,permissions=$3',[id,d.name,JSON.stringify(d.permissions)]);
  await db.query('DELETE FROM erp_sessions WHERE user_id IN (SELECT id FROM erp_users WHERE role_id=$1)',[id]);
  await db.query("INSERT INTO erp_audit(user_id,action,entity_id,details) VALUES($1,'ROLE_SAVE',$2,$3)",[actor.id,id,JSON.stringify(d)]);
  return {id};
 });
}
