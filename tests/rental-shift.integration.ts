import {spawn} from 'node:child_process';
import pg from 'pg';import {randomUUID} from 'node:crypto';import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';import ExcelJS from 'exceljs';
const base=process.env.TEST_DATABASE_URL;if(!base||!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw new Error('Use an explicitly configured local TEST_DATABASE_URL.');
const admin=new pg.Client({connectionString:base});await admin.connect();const name='rental_shift_'+randomUUID().replaceAll('-','');await admin.query(`CREATE DATABASE "${name}"`);const u=new URL(base);u.pathname='/'+name;process.env.DATABASE_URL=u.toString();const {pool}=await import('../src/lib/db');
let server:ReturnType<typeof spawn>|undefined;
try{for(const f of (await readdir('db')).filter(f=>/^\d.*sql$/.test(f)).sort())await pool.query(await readFile('db/'+f,'utf8'));
 const s=await import('../src/lib/service'),a=await import('../src/rental/accounting'),{validGstin}=await import('../src/rental/gst'),{materialGroups}=await import('../src/rental/material-ledger'),{materialExport}=await import('../src/rental/material-export');
 await pool.query("INSERT INTO company(id,name) VALUES(1,'JYOTI SCAFFOLD PRIVATE LIMITED')");const owner={id:randomUUID(),name:'Test Owner',login:'owner',role:'OWNER' as const,is_active:true};await pool.query("INSERT INTO erp_users(id,name,login,password_hash,role) VALUES($1,'Test Owner','owner','unused','OWNER')",[owner.id]);
 const gst='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(c=>'24ABCDE1234F1Z'+c).find(validGstin)!;assert.ok(gst);assert.equal(validGstin(gst.slice(0,14)+'!'),false);
 const customer=await s.saveCustomer({name:'EXAMPLE CUSTOMER',locking_days:10,gst_no:gst.toLowerCase(),address:'Example site address, Gujarat'});let ledger=(await pool.query('SELECT * FROM rental_acc_ledgers WHERE customer_id=$1',[customer.id])).rows[0];assert.ok(ledger);await assert.rejects(s.saveCustomer({name:'Duplicate',locking_days:10,gst_no:gst}),/unique/i);await s.saveCustomer({id:customer.id,name:'EXAMPLE CUSTOMER UPDATED',locking_days:10,gst_no:gst});assert.equal((await pool.query('SELECT party_details FROM rental_acc_ledgers WHERE customer_id=$1',[customer.id])).rows[0].party_details.mailing_name,'EXAMPLE CUSTOMER UPDATED');
 await s.saveCustomer({id:customer.id,name:'EXAMPLE CUSTOMER UPDATED',locking_days:10,gst_no:gst,mailing_name:'Example billing office',country:'India',place_of_supply:'Gujarat',gst_registration:'Regular'});
 const profile=(await s.state()).customers.find((c:any)=>c.id===customer.id)!;assert.equal(profile.mailing_name,'Example billing office');assert.equal(profile.place_of_supply,'Gujarat');assert.equal(profile.gst_registration,'Regular');
 assert.equal((await pool.query('SELECT count(*) FROM rental_acc_ledgers WHERE customer_id=$1',[customer.id])).rows[0].count,'1');
 await assert.rejects(s.saveCustomer({id:customer.id,name:'Invalid',locking_days:10,gst_registration:'Invalid'}));
 await assert.rejects(a.saveLedger(owner,{id:ledger.id,name:'Detached',group_name:'Bank Accounts',party_details:{},is_active:true}),/customer profile/);
 const item=await s.saveItem({name:'GALVANISED PIPE 4MTR',material_value:500,rate:2,effective_from:'2026-01-01'});await s.saveMovement({customer_id:customer.id,date:'2026-01-01',type:'DISPATCH',reference:'01164',lines:[{item_id:item.id,quantity:174}]});await s.saveMovement({customer_id:customer.id,date:'2026-01-02',type:'RETURN',reference:'0211',lines:[{item_id:item.id,quantity:16}]});await s.saveMovement({customer_id:customer.id,date:'2026-01-03',type:'RETURN',reference:'0237',lines:[{item_id:item.id,quantity:140}]});
 // A preview must not queue behind the write lock or persist stock changes.
 const blocker=await pool.connect();
 let deadline:ReturnType<typeof setTimeout>|undefined;
 try {
  await blocker.query('BEGIN');
  await blocker.query('SELECT pg_advisory_xact_lock(914712)');
  const preview=await Promise.race([
   s.saveMovement({customer_id:customer.id,date:'2026-01-04',type:'DISPATCH',lines:[{item_id:item.id,quantity:2}]},true),
   new Promise<never>((_,reject)=>{deadline=setTimeout(()=>reject(new Error('Preview blocked behind write lock')),2000);})
  ]);
  assert.equal(preview.previews[0].after,20);
  assert.equal((await pool.query('SELECT count(*) FROM movements')).rows[0].count,'3');
 } finally {clearTimeout(deadline);await blocker.query('ROLLBACK');blocker.release();}
 console.log('PASS: movement preview bypasses write contention without changing stock.');
 const {correctMovement}=await import('../src/rental/movement-corrections');
 const correctionCustomer=await s.saveCustomer({name:'Correction test',locking_days:10});
 await s.saveMovement({customer_id:correctionCustomer.id,date:'2026-02-01',type:'DISPATCH',lines:[{item_id:item.id,quantity:10,rental_rate:2}]});
 await s.saveMovement({customer_id:correctionCustomer.id,date:'2026-02-02',type:'RETURN',lines:[{item_id:item.id,quantity:4}]});
 const correctionRows=(await pool.query('SELECT * FROM movements WHERE customer_id=$1 ORDER BY date',[correctionCustomer.id])).rows;
 const dispatch=correctionRows[0],returned=correctionRows[1];
 const correction={id:dispatch.id,revision:0,action:'EDIT',reason:'Correct quantity',date:'2026-02-01',quantity:12,damaged_quantity:0,rental_rate:2};
 await assert.rejects(correctMovement({...owner,role:'RENTAL_STAFF'},correction),/Only the owner/);
 await correctMovement(owner,correction);
 assert.equal((await pool.query('SELECT original_quantity FROM dispatch_lots WHERE id=$1',[dispatch.id])).rows[0].original_quantity,12);
 await assert.rejects(correctMovement(owner,correction),/Another correction/);
 await assert.rejects(correctMovement(owner,{...correction,revision:1,quantity:2}),/return/i);
 await assert.rejects(correctMovement(owner,{id:dispatch.id,revision:1,action:'DELETE',reason:'Invalid delete'}),/return/i);
 await correctMovement(owner,{id:returned.id,revision:0,action:'EDIT',reason:'Return count corrected',date:returned.date,quantity:5,damaged_quantity:0});
 assert.equal(Number((await pool.query('SELECT sum(quantity) n FROM return_allocations WHERE return_id=$1',[returned.id])).rows[0].n),5);
 await correctMovement(owner,{id:returned.id,revision:1,action:'DELETE',reason:'Duplicate return'});
 await correctMovement(owner,{id:dispatch.id,revision:1,action:'DELETE',reason:'Duplicate dispatch'});
 assert.equal((await pool.query('SELECT count(*) FROM movements WHERE customer_id=$1',[correctionCustomer.id])).rows[0].count,'0');
 assert.equal((await pool.query('SELECT count(*) FROM rental_movement_revisions')).rows[0].count,'4');
 await assert.rejects(pool.query('DELETE FROM rental_movement_revisions'),/immutable/);
 console.log('PASS: owner-only movement correction, stale edit rejection, dependent-return protection, allocation rebuild and immutable deletion history.');
 const movements=(await pool.query('SELECT * FROM movements')).rows;const group=materialGroups([{id:item.id,name:'Pipe'}],movements,'2026-01-02','2026-01-03')[0];assert.equal(group.opening,174);assert.equal(group.received,156);assert.equal(group.pending,18);
 await mkdir('test-results/rental-shift',{recursive:true});for(const format of ['pdf','xlsx']){const out=await materialExport(new URLSearchParams({customer:customer.id,start:'2026-01-01',end:'2026-01-31',format}));await writeFile('test-results/rental-shift/material-ledger.'+format,new Uint8Array(out.bytes));if(format==='xlsx'){const b=new ExcelJS.Workbook();await b.xlsx.load(Buffer.from(out.bytes) as any);const text=JSON.stringify(b.getWorksheet(1)!.getSheetValues());assert.ok(text.includes('Issu Qty'));assert.ok(!/Original price|damage_price|rental_rate/.test(text));}}
 const {movementExport}=await import('../src/rental/movement-export');
 for(const format of ['pdf','xlsx']){
  const out=await movementExport(new URLSearchParams({start:'2026-01-02',end:'2026-01-03',type:'RETURN',search:'EXAMPLE',format}));
  await writeFile('test-results/rental-shift/movement-history.'+format,out.bytes);
  if(format==='xlsx'){
   const book=new ExcelJS.Workbook();await book.xlsx.load(Buffer.from(out.bytes) as any);
   const text=JSON.stringify(book.getWorksheet(1)!.getSheetValues());
   assert.ok(text.includes('0211')&&text.includes('0237'));assert.ok(!text.includes('01164'));
  }
 }
 await assert.rejects(movementExport(new URLSearchParams({start:'2026-02-01',end:'2026-01-01',format:'pdf'})),/Start date/);
 const quotation=await s.saveQuotation({customer_id:customer.id,date:'2026-01-01',deposit:100,terms:'Sample terms',reference:'TEST/Q1',gst_percent:18,required_documents:'GST certificate',lines:[{item_id:item.id,quantity:10,rate:2}]});
 const quote=(await pool.query('SELECT * FROM quotations WHERE id=$1',[quotation.id])).rows[0];
 assert.equal(quote.snapshot.reference,'TEST/Q1');assert.equal(quote.snapshot.lines[0].daily_total,'20.00');assert.equal(quote.snapshot.gst_percent,18);
 console.log('PASS: date/type/search-filtered PDF/Excel history and saved quotation financial fields.');
 const invoice:any=await s.createInvoice({customer_id:customer.id,period_start:'2026-01-01',period_end:'2026-01-31',gst_percent:0,notes:'',document_details:{payment_terms:'Within 15 days',tax_mode:'CGST_SGST'}});await s.finalizeInvoice(invoice.id);assert.equal((await pool.query('SELECT snapshot FROM invoices WHERE id=$1',[invoice.id])).rows[0].snapshot.document_details.payment_terms,'Within 15 days');const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});await a.saveAccountingSettings(owner,{company_name:'Jyoti Scaffold Private Limited',financial_year_start:'2026-01-01',closed_through:''});const bank=await a.saveLedger(owner,{name:'Bank',group_name:'Bank Accounts',party_details:{},is_active:true});const receipt={id:randomUUID(),type:'Receipt',date:today,narration:'Invoice payment',lines:[{ledger_id:bank.id,debit:10,credit:0},{ledger_id:ledger.id,debit:0,credit:10}],details:{receipt_invoice_id:invoice.id}};await a.postVoucher(owner,receipt);assert.equal((await a.postVoucher(owner,receipt)).repeated,true);await assert.rejects(a.postVoucher(owner,{...receipt,id:randomUUID(),lines:[{ledger_id:bank.id,debit:999999,credit:0},{ledger_id:ledger.id,debit:0,credit:999999}]}),/exceeds/);const reversed={id:randomUUID(),type:'Journal',date:today,narration:'Reverse payment',reverses_id:receipt.id,lines:receipt.lines.map(l=>({...l,debit:l.credit,credit:l.debit}))};await a.postVoucher(owner,reversed);assert.equal((await pool.query("SELECT count(*) n FROM rental_acc_vouchers v WHERE v.details->>'receipt_invoice_id'=$1 AND NOT EXISTS(SELECT 1 FROM rental_acc_vouchers r WHERE r.reverses_id=v.id)",[invoice.id])).rows[0].n,'0');

 const invoiceA=randomUUID(),invoiceB=randomUUID();
 for(const [id,no,total] of [[invoiceA,'TEST/A',20000],[invoiceB,'TEST/B',10000]]){
 await pool.query("INSERT INTO invoices(id,invoice_no,customer_id,period_start,period_end,status,gst_percent,snapshot,rental_total,damage_total,subtotal,gst_amount,grand_total,finalized_at) VALUES($1,$2,$3,'2025-01-01','2025-01-01','FINAL',0,'{}', $4,0,$4,0,$4,now())",[id,no,customer.id,total]);
 }
 const simple={id:randomUUID(),entry_mode:'simple',type:'Receipt',party_ledger_id:ledger.id,bank_ledger_id:bank.id,amount:8000,date:today,narration:'Partial customer payment',details:{allocations:[{invoice_id:invoiceA,amount:8000}]}};
 const concurrent=await Promise.all([a.postVoucher(owner,simple),a.postVoucher(owner,simple)]);assert.equal(concurrent.filter(r=>r.repeated).length,1);
 let financial=await a.accountingState();let balanceA=financial.invoices.find(i=>i.id===invoiceA)!;assert.equal(balanceA.paid,'8000.00');assert.equal(balanceA.outstanding,'12000.00');assert.equal(balanceA.payment_status,'Partially Paid');
 const split={...simple,id:randomUUID(),amount:22000,details:{allocations:[{invoice_id:invoiceA,amount:12000},{invoice_id:invoiceB,amount:10000}]}};
 await a.postVoucher(owner,split);financial=await a.accountingState();assert.equal(financial.invoices.find(i=>i.id===invoiceA)!.payment_status,'Fully Paid');assert.equal(financial.invoices.find(i=>i.id===invoiceB)!.outstanding,'0.00');
 await assert.rejects(a.postVoucher(owner,{...simple,id:randomUUID()}),/exceeds/);
 const original=(await pool.query('SELECT * FROM rental_acc_vouchers WHERE id=$1',[split.id])).rows[0];
 await a.postVoucher(owner,{id:randomUUID(),type:'Journal',date:today,narration:'Reverse split receipt',reverses_id:split.id,lines:original.lines.map((l:any)=>({ledger_id:l.ledger_id,debit:Number(l.credit),credit:Number(l.debit)}))});
 financial=await a.accountingState();assert.equal(financial.invoices.find(i=>i.id===invoiceA)!.outstanding,'12000.00');assert.equal(financial.invoices.find(i=>i.id===invoiceB)!.payment_status,'Unpaid');
 const payment=await a.postVoucher(owner,{...simple,id:randomUUID(),type:'Payment',amount:2000,details:{}});
 const paymentLines=(await pool.query('SELECT lines FROM rental_acc_vouchers WHERE id=$1',[payment.id])).rows[0].lines;
 assert.equal(paymentLines.find((l:any)=>l.ledger_id===bank.id).credit,'2000.00');
 await assert.rejects(a.postVoucher(owner,{...simple,id:randomUUID(),bank_ledger_id:ledger.id}),/different/);
 const {partyStatement}=await import('../src/rental/party-ledger');
 const {partyExport}=await import('../src/rental/party-export');
 const {saveFormat,loadFormats}=await import('../src/rental/ledger-format-service');
 const {defaultFormat}=await import('../src/rental/ledger-formats');
 const statement=partyStatement((await a.accountingState()).vouchers,ledger.id,'1900-01-01',today);
 const direct=(await pool.query("SELECT sum((l->>'debit')::numeric-(l->>'credit')::numeric) n FROM rental_acc_vouchers v CROSS JOIN LATERAL jsonb_array_elements(v.lines) l WHERE l->>'ledger_id'=$1",[ledger.id])).rows[0].n;
 assert.equal(Number(statement.closing),Number(direct));
 const originalMovement=(await pool.query('SELECT * FROM movements WHERE customer_id=$1 LIMIT 1',[customer.id])).rows[0];
 await assert.rejects(correctMovement(owner,{id:originalMovement.id,revision:0,action:'DELETE',reason:'Locked invoice test'}),/finalized invoice/);
 await assert.rejects(saveFormat({...owner,role:'RENTAL_STAFF'},{module:'party',settings:defaultFormat('party')}),/Only the owner/);
 await saveFormat(owner,{module:'party',settings:{...defaultFormat('party'),orientation:'landscape',footer:'Test export'}});
 assert.equal((await loadFormats()).party.orientation,'landscape');
 for(const format of ['pdf','xlsx']){
  const out=await partyExport(new URLSearchParams({ledger:ledger.id,start:'1900-01-01',end:today,format}));
  await writeFile('test-results/rental-shift/party-ledger.'+format,new Uint8Array(out.bytes));
  if(format==='xlsx'){const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(Buffer.from(out.bytes) as any);const text=JSON.stringify(workbook.getWorksheet(1)!.getSheetValues());assert.ok(text.includes('Jyoti Engineering & Scarfolding Pvt Ltd'));assert.ok(text.includes('Closing Balance'));assert.equal(workbook.getWorksheet(1)!.pageSetup.orientation,'landscape');}
 }
 console.log('PASS: party ledger matches posted balances, PDF/Excel exports share format settings, and finalized movements remain locked.');
 console.log('PASS: automatic receipt/payment double entry, partial/full/split allocations, reversal recalculation and concurrent retry idempotency.');
 if(process.argv.includes('--http')){
 const auth=await import('../src/shared/auth-server');await pool.query('UPDATE erp_users SET password_hash=$1 WHERE id=$2',[await auth.passwordHash('OnlyForLocalTest123'),owner.id]);
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3012'],{env:{...process.env,GST_LOOKUP_DISABLED:'1',SESSION_SECRET:'isolated-local-test-secret-at-least-32-characters'},stdio:'ignore',windowsHide:true});
 const baseUrl='http://127.0.0.1:3012';let ready=false;for(let i=0;i<40;i++){try{if((await fetch(baseUrl+'/login')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}assert.ok(ready,'Test server starts');
 assert.equal((await fetch(baseUrl+'/api/rental/accounting/state')).status,401);
 assert.equal((await fetch(baseUrl+'/api/rental/accounting/formats')).status,401);
 assert.equal((await fetch(baseUrl+'/api/rental/accounting/party-ledger')).status,401);

 const login=await fetch(baseUrl+'/api/shared/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:baseUrl},body:JSON.stringify({login:'owner',password:'OnlyForLocalTest123'})});assert.equal(login.status,200);const cookie=login.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');const headers={Cookie:cookie};
 assert.equal((await fetch(baseUrl+'/rental/accounting',{headers})).status,200);assert.equal((await fetch(baseUrl+'/api/manufacturing/state',{headers})).status,410);assert.equal((await fetch(baseUrl+'/manufacturing',{headers,redirect:'manual'})).headers.get('location'),'/rental');
 assert.equal((await fetch(baseUrl+'/api/rental/accounting/state',{headers})).status,200);assert.equal((await fetch(baseUrl+'/api/rental/gst?gstin='+gst,{headers})).status,503);
 const voucherPdf=await fetch(baseUrl+'/api/rental/accounting/vouchers/'+receipt.id+'/pdf',{headers});assert.equal(voucherPdf.status,200);assert.equal(voucherPdf.headers.get('content-type'),'application/pdf');assert.equal((await fetch(baseUrl+'/api/rental/accounting/vouchers/'+receipt.id+'/pdf')).status,401);
 const pdf=await fetch(baseUrl+'/api/rental/material-ledger?'+new URLSearchParams({customer:customer.id,start:'2026-01-01',end:'2026-01-31',format:'pdf'}),{headers});assert.equal(pdf.status,200);assert.equal(pdf.headers.get('content-type'),'application/pdf');
 await auth.saveUser(owner,{name:'Rental test',login:'rental',role:'RENTAL_STAFF',is_active:true,password:'OnlyForLocalTest123'});const r=await fetch(baseUrl+'/api/shared/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:baseUrl},body:JSON.stringify({login:'rental',password:'OnlyForLocalTest123'})});const staffCookie=r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');assert.equal((await fetch(baseUrl+'/api/rental/accounting/state',{headers:{Cookie:staffCookie}})).status,200);assert.equal((await fetch(baseUrl+'/api/shared/users',{headers:{Cookie:staffCookie}})).status,403);
 assert.equal((await fetch(baseUrl+'/api/rental/accounting/movements',{method:'POST',headers:{Cookie:staffCookie,'Content-Type':'application/json',Origin:baseUrl},body:JSON.stringify({})})).status,403);
 assert.equal((await fetch(baseUrl+'/api/rental/accounting/formats',{method:'POST',headers:{Cookie:staffCookie,'Content-Type':'application/json',Origin:baseUrl},body:JSON.stringify({})})).status,403);
 assert.equal((await fetch(baseUrl+'/api/rental/accounting/movement-history',{headers:{Cookie:staffCookie}})).status,403);
 assert.equal((await fetch(baseUrl+'/api/rental/accounting/movement-history',{headers})).status,200);
 assert.equal((await fetch(baseUrl+'/api/rental/accounting/party-ledger?'+new URLSearchParams({ledger:ledger.id,start:'1900-01-01',end:today,format:'pdf'}),{headers})).status,200);
 console.log('PASS: HTTP authentication, rental staff accounting, owner-only access, manufacturing retirement, GST not-configured response and PDF download.');
 }
 console.log('PASS: GST checksum/uniqueness, atomic customer-ledger sync, protected linkage, inward/outward/opening balances, PDF/Excel exports, receipt idempotency, overpayment rejection and reversal.');
}finally{server?.kill();await pool.end();await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);await admin.end();}
