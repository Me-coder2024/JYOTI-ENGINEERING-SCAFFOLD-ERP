import nextEnv from '@next/env';
import pg from 'pg';
import {readFile,readdir} from 'node:fs/promises';
import {parseEnv,isDeepStrictEqual} from 'node:util';
nextEnv.loadEnvConfig(process.cwd());
pg.types.setTypeParser(1082,v=>v);
pg.types.setTypeParser(1114,v=>v);
pg.types.setTypeParser(1184,v=>v);
// This tool never prints connection strings, credentials or customer records.
const targetEnv=parseEnv(await readFile('deploy/production.env','utf8'));
const sourceUrl=process.env.DATABASE_URL,targetUrl=targetEnv.DIRECT_DATABASE_URL;
if(!sourceUrl||!targetUrl)throw new Error('Set local DATABASE_URL and deploy/production.env DIRECT_DATABASE_URL.');
if(sourceUrl===targetUrl)throw new Error('Source and destination must be different databases.');
const targetAddress=new URL(targetUrl);
if(!['verify-full','verify-ca'].includes(targetAddress.searchParams.get('sslmode')||''))throw new Error('Destination requires certificate-verified TLS.');
if(targetAddress.port==='6543')throw new Error('Use a direct connection or session pooler (5432) for migration.');
const source=new pg.Client({connectionString:sourceUrl}),target=new pg.Client({connectionString:targetUrl});
const quote=(s:string)=>'"'+s.replaceAll('"','""')+'"';
const rental=['company','items','rates','customers','movements','dispatch_lots','return_allocations','invoices','quotations','audit_log','rental_periods','schema_migrations'];
try{await source.connect();await target.connect();await source.query("SET TIME ZONE 'UTC'");await target.query("SET TIME ZONE 'UTC'");await source.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
 const tables=(await source.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(r=>r.tablename as string).filter(t=>rental.includes(t)||t.startsWith('mfg_')||t.startsWith('erp_'));
 const existing=(await target.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename=ANY($1)",[tables])).rows;if(existing.length)throw new Error('Destination already contains ERP tables. Use an empty dedicated project; nothing has been overwritten.');
 if(!process.argv.includes('--apply')){for(const t of tables){const n=(await source.query(`SELECT count(*) n FROM public.${quote(t)}`)).rows[0].n;console.log(`${t}: ${n} rows`);}console.log('Read-only preflight passed. No remote changes. To migrate, disable the destination Data API, confirm the environment flag, then run with --apply during a maintenance window.');}
 else {
  if(targetEnv.SUPABASE_DATA_API_DISABLED!=='true')throw new Error('Disable the Supabase Data API for this project, then set SUPABASE_DATA_API_DISABLED=true. The ERP uses its authenticated server API, not anonymous Supabase table access.');
  await source.query(`LOCK TABLE ${tables.map(t=>'public.'+quote(t)).join(',')} IN SHARE MODE`);
  await target.query('BEGIN');
  for(const f of (await readdir('db')).filter(f=>/^\d+.*\.sql$/.test(f)).sort())await target.query(await readFile('db/'+f,'utf8'));
  await target.query('CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())');
  for(const f of ['schema.sql','production.sql','accounting.sql'])await target.query(await readFile('manufacturing/'+f,'utf8'));
  // Remove the newly inserted empty settings row before copying the real settings.
  await target.query('DELETE FROM mfg_accounting_settings');
  const relationships=(await source.query("SELECT child.relname child,parent.relname parent FROM pg_constraint fk JOIN pg_class child ON child.oid=fk.conrelid JOIN pg_class parent ON parent.oid=fk.confrelid WHERE fk.contype='f' AND child.relnamespace='public'::regnamespace")).rows;
  const ordered:string[]=[],pending=new Set(tables);while(pending.size){const next=[...pending].find(t=>relationships.filter(r=>r.child===t&&r.parent!==t&&tables.includes(r.parent)).every(r=>ordered.includes(r.parent)));if(!next)throw new Error('Unresolved table dependency. Migration rolled back.');ordered.push(next);pending.delete(next);}
  for(const table of ordered){if(['erp_sessions','erp_login_attempts'].includes(table))continue;
   const rows=(await source.query(`SELECT * FROM public.${quote(table)}`)).rows;
   if(table==='mfg_vouchers')rows.sort((a,b)=>Number(!!a.reverses_id)-Number(!!b.reverses_id));
   const columns=(await source.query("SELECT column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position",[table])).rows;
   const sql=`INSERT INTO public.${quote(table)}(${columns.map(c=>quote(c.column_name)).join(',')}) VALUES(${columns.map((_,i)=>'$'+(i+1)).join(',')})`;
   for(const row of rows)await target.query(sql,columns.map(c=>['json','jsonb'].includes(c.data_type)?JSON.stringify(row[c.column_name]):row[c.column_name]));
   const count=Number((await target.query(`SELECT count(*) n FROM public.${quote(table)}`)).rows[0].n);if(count!==rows.length)throw new Error(`Count mismatch in ${table}.`);
   const original=(await source.query(`SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY md5(to_jsonb(t)::text)),'[]'::jsonb) data FROM public.${quote(table)} t`)).rows[0].data;
   const copied=(await target.query(`SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY md5(to_jsonb(t)::text)),'[]'::jsonb) data FROM public.${quote(table)} t`)).rows[0].data;
   if(!isDeepStrictEqual(original,copied)){const canonical=(a:any[])=>[...a].sort((x,y)=>JSON.stringify(x).localeCompare(JSON.stringify(y)));const a=canonical(original),b=canonical(copied);if(!isDeepStrictEqual(a,b)){console.log('Mismatch fields:',Object.keys(a.find((r:any,i:number)=>!isDeepStrictEqual(r,b[i]))||{}).filter(k=>a.some((r:any,i:number)=>!isDeepStrictEqual(r[k],b[i]?.[k]))));throw new Error(`Content mismatch in ${table}.`);}}console.log(`Verified ${table}: ${count} rows`);
  }
  const sequences=(await source.query("SELECT sequencename FROM pg_sequences WHERE schemaname='public'")).rows;
  for(const {sequencename} of sequences){if(!/^(mfg_|erp_|invoice_number$|audit_log_)/.test(sequencename))continue;const value=(await source.query(`SELECT last_value,is_called FROM public.${quote(sequencename)}`)).rows[0];await target.query('SELECT setval($1::regclass,$2,$3)',['public.'+quote(sequencename),value.last_value,value.is_called]);}
  // Defence in depth: browser-facing API roles must not access the ERP tables.
  for(const role of ['anon','authenticated'])if((await target.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount){await target.query(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${quote(role)}`);await target.query(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ${quote(role)}`);}
  await target.query('COMMIT');console.log('Migration committed and row contents verified. Local data is unchanged. Sessions were intentionally not migrated; users must sign in again. Switch the runtime only after a hosted smoke test.');
 }
 await source.query('ROLLBACK');
}catch(e){await target.query('ROLLBACK').catch(()=>{});await source.query('ROLLBACK').catch(()=>{});console.error((e as Error).message.replace(/postgres(?:ql)?:\/\/\S+/g,'[database URL redacted]'));process.exitCode=1;}finally{await source.end().catch(()=>{});await target.end().catch(()=>{});}
