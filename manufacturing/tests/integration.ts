import nextEnv from '@next/env';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
nextEnv.loadEnvConfig(process.cwd());
const admin=new pg.Client({connectionString:process.env.DATABASE_URL});await admin.connect();
const database='mfg_test_'+randomUUID().replaceAll('-','');await admin.query(`CREATE DATABASE "${database}"`);
const url=new URL(process.env.DATABASE_URL!);url.pathname='/'+database;process.env.DATABASE_URL=url.toString();
const {pool}=await import('../../src/lib/db');
let server:ReturnType<typeof spawn>|undefined;
try {
 for(const file of (await readdir('db')).filter(f=>/^\d+.*\.sql$/.test(f)).sort())await pool.query(await readFile('db/'+file,'utf8'));
 await pool.query("INSERT INTO company(id,name,unit1,mobile,email,bank_name,bank_account,bank_ifsc) VALUES(1,'Jyoti Engineering','Ahmedabad, Gujarat','8481000092','office@example.com','Test Bank','12345678','TEST0001234')");
 const rentalBefore=JSON.stringify((await pool.query('SELECT * FROM company')).rows);
 await pool.query(await readFile('manufacturing/schema.sql','utf8'));
 await pool.query(await readFile('manufacturing/production.sql','utf8'));await pool.query(await readFile('manufacturing/accounting.sql','utf8'));
 const auth=await import('../../src/shared/auth-server');const s=await import('../../src/manufacturing/service');
 const owner={id:randomUUID(),name:'Owner',login:'owner',role:'OWNER' as const,is_active:true};
 await pool.query('INSERT INTO erp_users(id,name,login,role,password_hash) VALUES($1,$2,$3,$4,$5)',[owner.id,owner.name,owner.login,owner.role,await auth.passwordHash('TestPassword123')]);
 for(const [login,role] of [['rental','RENTAL_STAFF'],['factory','MANUFACTURING_STAFF']])await auth.saveUser(owner,{name:login,login,role,is_active:true,password:'TestPassword123'});
 const supplier=await s.saveMaster(owner,'suppliers',{name:'Steel Supplier'}),raw=await s.saveMaster(owner,'raw',{name:'Steel tube',unit:'kg'});
 const customer=await s.saveMaster(owner,'customers',{name:'Manufacturing Customer',address:'Ahmedabad'}),fg=await s.saveMaster(owner,'finished',{name:'Adjustable scaffolding base jack',sale_rate:250,hsn_code:'73084000'});
 const po=await s.saveOrder(owner,'purchase',{party_id:supplier.id,date:'2026-06-01',lines:[{item_id:raw.id,quantity:100,rate:50}]});await s.transitionOrder(owner,'purchase',po.id,'activate');
 const receipt={id:randomUUID(),order_id:po.id,date:'2026-06-02',lines:[{item_id:raw.id,quantity:30}]};await s.postMovement(owner,'purchase',receipt);await s.postMovement(owner,'purchase',receipt);
 assert.equal(Number((await s.getState()).raw[0].current_stock_qty),30);
 await assert.rejects(()=>s.postMovement(owner,'purchase',{...receipt,id:randomUUID(),lines:[{item_id:raw.id,quantity:1},{item_id:randomUUID(),quantity:1}]}),/not on the selected order/);
 assert.equal(Number((await s.getState()).raw[0].current_stock_qty),30,'A bad second line rolls the entire receipt back');
 await assert.rejects(()=>s.postMovement(owner,'purchase',{...receipt,lines:[{item_id:raw.id,quantity:31}]}),/already used/);
 const concurrent=await Promise.allSettled([1,2].map(()=>s.postMovement(owner,'purchase',{...receipt,id:randomUUID(),lines:[{item_id:raw.id,quantity:50}]})));assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,1);
 assert.equal((await s.getState()).purchase[0].status,'PARTIALLY_RECEIVED');
 await s.postMovement(owner,'purchase',{...receipt,id:randomUUID(),lines:[{item_id:raw.id,quantity:20}]});assert.equal((await s.getState()).purchase[0].status,'RECEIVED');
 await assert.rejects(()=>s.saveMaster(owner,'finished',{id:fg.id,name:'Jack',current_stock_qty:500}),/cannot be edited/);
 await s.openingStock(owner,{id:randomUUID(),finished_good_id:fg.id,date:'2026-06-02',quantity:70,notes:'Approved initial physical count'});
 await assert.rejects(()=>s.openingStock(owner,{id:randomUUID(),finished_good_id:fg.id,date:'2026-06-02',quantity:10,notes:'Second count'}),/only be recorded once/);
 const so=await s.saveOrder(owner,'sales',{party_id:customer.id,date:'2026-06-01',lines:[{item_id:fg.id,quantity:70,rate:250}]});await s.transitionOrder(owner,'sales',so.id,'activate');
 const dispatch={id:randomUUID(),order_id:so.id,date:'2026-06-03',lines:[{item_id:fg.id,quantity:30}]};
 await assert.rejects(()=>s.postMovement(owner,'sales',{...dispatch,date:'2026-06-01'}),/insufficient/);
 await s.postMovement(owner,'sales',dispatch);await s.postMovement(owner,'sales',dispatch);
 assert.equal(Number((await s.getState()).finished[0].current_stock_qty),40);
 await assert.rejects(()=>s.issueInvoice(owner,{sales_order_id:so.id,date:'2026-06-03',gst_percent:18}),/Fully dispatch/);
 await assert.rejects(()=>s.transitionOrder(owner,'sales',so.id,'cancel'),/posted movements/);
 await assert.rejects(()=>s.postMovement(owner,'sales',{...dispatch,id:randomUUID(),lines:[{item_id:fg.id,quantity:41}]}),/only 40/);
 await s.postMovement(owner,'sales',{...dispatch,id:randomUUID(),lines:[{item_id:fg.id,quantity:40}]});
 await assert.rejects(()=>s.issueInvoice(owner,{sales_order_id:so.id,date:'2026-06-03',gst_percent:18.123}),/2 decimal places/);
 const invoice=await s.issueInvoice(owner,{sales_order_id:so.id,date:'2026-06-03',gst_percent:18});const document=await s.getDocument('invoice',invoice.id);
 assert.equal(document.grand_total,'20650.00');assert.match(document.invoice_no,/^JM\//);
 await assert.rejects(()=>s.issueInvoice(owner,{sales_order_id:so.id,date:'2026-06-03',gst_percent:18}),/Fully dispatch/);
 await assert.rejects(()=>pool.query('UPDATE mfg_sales_invoices SET grand_total=1 WHERE id=$1',[invoice.id]),/immutable/i);
 assert.equal((await s.removeMaster(owner,'finished',fg.id)).archived,true);
 await (await import('./extended')).extendedTests(owner,customer.id,invoice.id);
 assert.equal(JSON.stringify((await pool.query('SELECT * FROM company')).rows),rentalBefore);
 for(const table of ['customers','items','movements','invoices','audit_log'])assert.equal(Number((await pool.query(`SELECT count(*) n FROM ${table}`)).rows[0].n),0);
 const {manufacturingPdf}=await import('../../src/manufacturing/pdf');await mkdir('test-results/manufacturing',{recursive:true});
 for(const [kind,key] of [['purchase',po.id],['sales',so.id],['invoice',invoice.id]])await writeFile(`test-results/manufacturing/${kind}.pdf`,await manufacturingPdf(kind,await s.getDocument(kind,key)));
 console.log('PASS: partial and concurrent receipts, duplicate submission protection, opening-stock audit, historical availability, partial dispatch, no overdispatch, invoice totals, immutable invoice, rental data isolation and PDFs.');
 if(process.argv.includes('--http')){
  const base='http://127.0.0.1:3011';let output='';server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3011'],{env:{...process.env},windowsHide:true,stdio:'pipe'});server.stdout?.on('data',d=>output+=d);server.stderr?.on('data',d=>output+=d);
  let ready=false;for(let i=0;i<60;i++){try{if((await fetch(base+'/login')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
  for(const [login,home,forbidden] of [['owner','/modules',''],['rental','/rental','/manufacturing'],['factory','/manufacturing','/rental']]){
   const response=await fetch(base+'/api/shared/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({login,password:'TestPassword123'})});assert.equal(response.status,200,await response.clone().text());
   const cookies=response.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');assert.equal((await response.json()).redirect,home);
   assert.equal((await fetch(base+home,{headers:{Cookie:cookies}})).status,200);
   assert.equal((await fetch(base+'/api/manufacturing/accounting/state',{headers:{Cookie:cookies}})).status,login==='rental'?403:200);
   if(login==='factory')assert.equal((await fetch(base+'/api/manufacturing/accounting/settings',{method:'POST',headers:{Cookie:cookies,Origin:base,'Content-Type':'application/json'},body:'{}'})).status,403);
   if(forbidden){assert.equal((await fetch(base+forbidden,{headers:{Cookie:cookies}})).status,403);const endpoint=forbidden==='/rental'?'/api/state':'/api/manufacturing/state';for(const method of ['GET','POST'])assert.equal((await fetch(base+endpoint,{method,headers:{Cookie:cookies,Origin:base}})).status,403);assert.equal((await fetch(base+'/api/shared/users',{headers:{Cookie:cookies}})).status,403);}
   assert.equal((await fetch(base+'/api/shared/logout',{method:'POST',headers:{Cookie:cookies,Origin:base}})).status,200);
   assert.equal((await fetch(base+'/api/manufacturing/state',{headers:{Cookie:cookies}})).status,401);
  }
  assert.equal((await fetch(base+'/api/login',{method:'POST'})).status,403);
  const loggedIn=await auth.login({login:'factory',password:'TestPassword123'});
  assert.ok(await auth.sessionUser(loggedIn.token));
  await auth.saveUser(owner,{...loggedIn.user,is_active:false});
  assert.equal(await auth.sessionUser(loggedIn.token),null);
  console.log('PASS: production HTTP login, owner chooser, staff routing, cross-module page/API 403, owner-only user management and logout session revocation.');
 }
}finally{if(server){server.kill();await new Promise(r=>server!.once('exit',r));}await pool.end();await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);await admin.end();}
