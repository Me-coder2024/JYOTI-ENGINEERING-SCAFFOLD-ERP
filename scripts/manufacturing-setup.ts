import nextEnv from '@next/env';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
nextEnv.loadEnvConfig(process.cwd());
const {pool,transaction}=await import('../src/lib/db');
const {passwordHash}=await import('../src/shared/auth-server');
try {
 await transaction(async db=>{await db.query('SELECT pg_advisory_xact_lock(914714)');await db.query('SELECT pg_advisory_xact_lock(914713)');await db.query(await readFile('manufacturing/schema.sql','utf8'));await db.query(await readFile('manufacturing/production.sql','utf8'));await db.query(await readFile('manufacturing/accounting.sql','utf8'));});
 if(!(await pool.query("SELECT 1 FROM erp_users WHERE role='OWNER'")).rowCount){
  const password=process.env.ERP_OWNER_PASSWORD||process.env.OFFICE_PASSWORD;
  if(!password||password.length<8)throw new Error('Set ERP_OWNER_PASSWORD (at least 8 characters) before creating the first owner.');
  await pool.query("INSERT INTO erp_users(id,name,login,password_hash,role) VALUES($1,'Jyoti Owner',$2,$3,'OWNER')",[randomUUID(),process.env.ERP_OWNER_LOGIN||'owner',await passwordHash(password)]);
  console.log('Created owner account. Login: '+(process.env.ERP_OWNER_LOGIN||'owner')+'. Password: ERP_OWNER_PASSWORD, or the existing office password when not set.');
 }
 console.log('Manufacturing and shared access schema ready. No rental tables were modified.');
}finally{await pool.end();}
