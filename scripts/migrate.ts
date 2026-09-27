import nextEnv from '@next/env';
import { readFile, readdir } from 'node:fs/promises';
nextEnv.loadEnvConfig(process.cwd());
const { pool } = await import('../src/lib/db');
const client=await pool.connect();
try {
 await client.query('BEGIN');
 await client.query('SELECT pg_advisory_xact_lock(914712)');
 await client.query('CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
 const applied=new Set((await client.query('SELECT name FROM schema_migrations')).rows.map(r=>r.name));
 for(const file of (await readdir('db')).filter(f=>/^\d+.*\.sql$/.test(f)).sort()) {
  if(applied.has(file)) continue;
  await client.query(await readFile('db/'+file,'utf8'));
  await client.query('INSERT INTO schema_migrations(name) VALUES($1)',[file]);
  console.log('Applied '+file);
 }
 await client.query('COMMIT');
}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
console.log('PostgreSQL schema is ready.');
await pool.end();

