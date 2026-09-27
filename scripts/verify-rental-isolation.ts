import nextEnv from '@next/env';
import { readFile,writeFile } from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
nextEnv.loadEnvConfig(process.cwd());
const manifest=JSON.parse(await readFile('verification/rental-baseline.json','utf8'));
for(const [file,hash] of Object.entries(manifest.files))assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'),hash,`Frozen rental file changed: ${file}`);
console.log(`PASS: all ${Object.keys(manifest.files).length} original files are byte-for-byte unchanged.`);
const {pool}=await import('../src/lib/db');
try{
 const tables=['company','items','rates','customers','movements','dispatch_lots','return_allocations','invoices','quotations','audit_log','rental_periods','schema_migrations'];
 const structure={
  columns:(await pool.query(`SELECT table_name,column_name,ordinal_position,column_default,is_nullable,data_type,character_maximum_length,numeric_precision,numeric_scale FROM information_schema.columns WHERE table_schema='public' AND table_name=ANY($1) ORDER BY table_name,ordinal_position`,[tables])).rows,
  constraints:(await pool.query(`SELECT cl.relname AS table_name,c.conname,pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_class cl ON cl.oid=c.conrelid WHERE cl.relnamespace='public'::regnamespace AND cl.relname=ANY($1) ORDER BY cl.relname,c.conname`,[tables])).rows,
  indexes:(await pool.query('SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname=\'public\' AND tablename=ANY($1) ORDER BY tablename,indexname',[tables])).rows,
  triggers:(await pool.query(`SELECT cl.relname,t.tgname,pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t JOIN pg_class cl ON cl.oid=t.tgrelid WHERE NOT t.tgisinternal AND cl.relname=ANY($1) ORDER BY cl.relname,t.tgname`,[tables])).rows,
  functions:(await pool.query("SELECT proname,pg_get_functiondef(oid) AS definition FROM pg_proc WHERE proname='protect_final_invoice'")).rows
 };
 const filename='verification/rental-schema-baseline.json';
 if(process.argv.includes('--record-schema')){await writeFile(filename,JSON.stringify(structure,null,2));console.log('Recorded rental schema baseline.');}
 else {const baseline=JSON.parse(await readFile(filename,'utf8'));
 // PostgreSQL 18 exposes NOT NULL as pg_constraint entries; older servers do not.
 // information_schema.columns.is_nullable above verifies the same constraint on both.
 const normalize=(s:typeof structure)=>({...s,constraints:s.constraints.filter(c=>!c.definition.startsWith('NOT NULL '))});
 assert.deepEqual(normalize(structure),normalize(baseline));console.log('PASS: rental columns, defaults, constraints, indexes, triggers and invoice protection function unchanged.');}
 const links=(await pool.query(`SELECT c.conname FROM pg_constraint c JOIN pg_class child ON child.oid=c.conrelid JOIN pg_class parent ON parent.oid=c.confrelid WHERE c.contype='f' AND child.relname LIKE 'mfg_%' AND parent.relname=ANY($1)`,[tables])).rows;
 assert.equal(links.length,0);console.log('PASS: no manufacturing foreign keys reference rental tables.');
}finally{await pool.end();}
