import { createHash, randomBytes, randomUUID, scrypt as rawScrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { pool, transaction } from '@/lib/db';
import { z } from 'zod';
import { AccessError, allowed, type User } from './access';
const scrypt=promisify(rawScrypt);
export const sessionHash=(token:string)=>createHash('sha256').update(token).digest('hex');
export async function passwordHash(password:string) {const salt=randomBytes(16).toString('hex');return `${salt}:${(await scrypt(password,salt,64) as Buffer).toString('hex')}`;}
export async function checkPassword(password:string,hash:string) {const [salt,key]=hash.split(':');if(!salt||!key)return false;const expected=Buffer.from(key,'hex'),actual=await scrypt(password,salt,64) as Buffer;return actual.length===expected.length&&timingSafeEqual(actual,expected);}
export async function sessionUser(token?:string):Promise<User|null> {
 if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
 const {rows}=await pool.query(`SELECT u.id,u.name,u.login,u.role,u.is_active FROM erp_sessions s JOIN erp_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.is_active`,[sessionHash(token)]);
 return rows[0]||null;
}
export async function login(input:unknown) {
 const d=z.object({login:z.string().trim().min(1).max(160),password:z.string().min(1).max(256)}).parse(input),key=sessionHash(d.login.toLowerCase());
 const attempt=(await pool.query(`INSERT INTO erp_login_attempts(key,attempts,expires_at) VALUES($1,1,now()+interval '15 minutes') ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN erp_login_attempts.expires_at<now() THEN 1 ELSE erp_login_attempts.attempts+1 END, expires_at=CASE WHEN erp_login_attempts.expires_at<now() THEN now()+interval '15 minutes' ELSE erp_login_attempts.expires_at END RETURNING attempts`,[key])).rows[0];
 if(attempt.attempts>10)throw new AccessError('Too many sign-in attempts. Try again in 15 minutes.',429);
 const user=(await pool.query('SELECT * FROM erp_users WHERE login=$1',[d.login.toLowerCase()])).rows[0];
 const dummy='00000000000000000000000000000000:'+('00'.repeat(64));
 const valid=await checkPassword(d.password,user?.password_hash||dummy);
 if(!user?.is_active||!valid)throw new AccessError('Incorrect login or password.',401);
 const token=randomBytes(32).toString('hex');
 await transaction(async db=>{await db.query('DELETE FROM erp_login_attempts WHERE key=$1',[key]);await db.query("INSERT INTO erp_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '12 hours')",[sessionHash(token),user.id]);await db.query("INSERT INTO erp_audit(user_id,action,entity_id) VALUES($1,'LOGIN',$2)",[user.id,user.id]);});
 return {token,user:{id:user.id,name:user.name,login:user.login,role:user.role,is_active:user.is_active} as User};
}
export async function logout(token?:string) {if(token)await pool.query('DELETE FROM erp_sessions WHERE token_hash=$1',[sessionHash(token)]);}
export async function saveUser(actor:User,input:unknown) {
 if(!allowed(actor.role,'owner'))throw new AccessError('Owner access required.',403);
 const d=z.object({id:z.string().uuid().optional(),name:z.string().trim().min(1).max(100),login:z.string().trim().min(1).max(160).transform(s=>s.toLowerCase()),role:z.enum(['OWNER','RENTAL_STAFF','MANUFACTURING_STAFF']),is_active:z.boolean(),password:z.string().max(256).optional()}).parse(input);
 if((!d.id||d.password)&&(!d.password||d.password.length<8))throw new AccessError('Use a password with at least 8 characters.');
 if(d.id===actor.id&&(!d.is_active||d.role!=='OWNER'))throw new AccessError('You cannot disable or demote your own owner account.');
 const hash=d.password?await passwordHash(d.password):undefined;
 return transaction(async db=>{
  await db.query('SELECT pg_advisory_xact_lock(914714)');
  const id=d.id||randomUUID(),old=d.id?(await db.query('SELECT * FROM erp_users WHERE id=$1 FOR UPDATE',[id])).rows[0]:null;
  if(d.id&&!old)throw new AccessError('User not found.',404);
  if(old?.role==='OWNER'&&old.is_active&&(!d.is_active||d.role!=='OWNER')){
   if(Number((await db.query("SELECT count(*) AS n FROM erp_users WHERE role='OWNER' AND is_active")).rows[0].n)<=1)throw new AccessError('Keep at least one active owner.');
  }
  await db.query(`INSERT INTO erp_users(id,name,login,password_hash,role,is_active) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET name=$2,login=$3,password_hash=$4,role=$5,is_active=$6`,[id,d.name,d.login,hash||old?.password_hash,d.role,d.is_active]);
  if(old&&(hash||old.role!==d.role||!d.is_active))await db.query('DELETE FROM erp_sessions WHERE user_id=$1',[id]);
  await db.query("INSERT INTO erp_audit(user_id,action,entity_id,details) VALUES($1,'USER_SAVE',$2,$3)",[actor.id,id,JSON.stringify({name:d.name,login:d.login,role:d.role,is_active:d.is_active,password_changed:!!hash})]);return {id};
 });
}
