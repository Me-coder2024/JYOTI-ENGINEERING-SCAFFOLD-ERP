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
 const newParty=await s.saveCustomer({name:'New challan customer',locking_days:0});
 const otherItem=await s.saveItem({name:'New challan material',material_value:100,rate:1,effective_from:'2026-01-01'});
 const batch=await s.saveMovement({customer_id:newParty.id,date:'2026-01-01',type:'DISPATCH',vehicle_no:'GJ01AB1234',lines:[{item_id:item.id,quantity:2},{item_id:otherItem.id,quantity:3}]});
 assert.match(batch.reference,/^DC-/);
 const batchRows=(await pool.query('SELECT * FROM movements WHERE challan_id=$1',[batch.challan_id])).rows;
 assert.equal(batchRows.length,2);assert.ok(batchRows.every(r=>r.customer_id===newParty.id&&r.reference===batch.reference&&r.vehicle_no==='GJ01AB1234'));
 const {challanExport}=await import('../src/rental/challan-export');assert.ok((await challanExport(batchRows[0].id)).bytes.length>1000);
 const {movementExport:filteredExport}=await import('../src/rental/movement-export');const filtered=await filteredExport(new URLSearchParams({start:'2026-01-01',end:'2026-01-02',format:'xlsx',customer:newParty.id,challan:batch.reference}));assert.ok(filtered.bytes.length>1000);
 console.log('PASS: customer-linked multi-item challan, optional vehicle, generated number and filtered exports.');
 const {loadChallan}=await import('../src/rental/challan-export');
 assert.equal((await loadChallan(batchRows[0].id)).rows.length,2);
 const siteCustomer=await s.saveCustomer({name:'Multi-site customer',locking_days:0,sites:['Site A','Site B']});
 await assert.rejects(s.saveCustomer({name:'Duplicate site',locking_days:0,sites:['Site A','site a']}),/unique/);
 const sitePayload={customer_id:siteCustomer.id,date:'2026-01-01',type:'DISPATCH',reference:'SITE-001',lines:[{item_id:item.id,quantity:10},{item_id:otherItem.id,quantity:5}]};
 await assert.rejects(s.saveMovement(sitePayload),/Select a valid customer site/);
 await assert.rejects(s.saveMovement({...sitePayload,site_name:'Unrelated site'}),/valid customer site/);
 const siteBatch=await s.saveMovement({...sitePayload,site_name:'Site A'});
 await s.saveMovement({...sitePayload,reference:'SITE-002',site_name:'Site B',lines:[{item_id:item.id,quantity:2}]});
 await assert.rejects(s.saveMovement({...sitePayload,type:'RETURN',date:'2026-01-02',site_name:'Site B',lines:[{item_id:item.id,quantity:3}]}),/only 2/);
 await s.saveMovement({...sitePayload,type:'RETURN',date:'2026-01-02',site_name:'Site A',lines:[{item_id:item.id,quantity:3}]});
 const siteRows=(await pool.query('SELECT * FROM movements WHERE challan_id=$1',[siteBatch.challan_id])).rows;
 const printed=await loadChallan(siteRows[0].id);assert.equal(printed.rows.length,2);assert.ok(printed.rows.every(r=>r.site_name==='Site A'));
 await assert.rejects(s.saveCustomer({id:siteCustomer.id,name:'Multi-site customer',locking_days:0,sites:['Site B']}),/cannot be removed/);
 // A legacy multi-item challan is printable together without changing its IDs.
 await pool.query('UPDATE movements SET challan_id=NULL WHERE challan_id=$1',[siteBatch.challan_id]);
 assert.equal((await loadChallan(siteRows[1].id)).rows.length,2);
 // Adding sites later does not strand existing unassigned stock.
 await s.saveCustomer({id:newParty.id,name:'New challan customer',locking_days:0,sites:['New site']});
 await s.saveMovement({customer_id:newParty.id,date:'2026-01-03',type:'RETURN',legacy_site:true,lines:[{item_id:otherItem.id,quantity:1}]});
 console.log('PASS: optional sites, required valid site selection, site-isolated returns, protected used sites and full modern/legacy challan printing.');

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
 const movements=(await pool.query('SELECT * FROM movements WHERE customer_id=$1',[customer.id])).rows;const group=materialGroups([{id:item.id,name:'Pipe'}],movements,'2026-01-02','2026-01-03')[0];assert.equal(group.opening,174);assert.equal(group.received,156);assert.equal(group.pending,18);
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
 const invoice:any=await s.createInvoice({customer_id:customer.id,period_start:'2026-01-01',period_end:'2026-01-31',gst_percent:0,notes:'',document_details:{payment_terms:'Within 15 days',tax_mode:'CGST_SGST'}});await a.saveAccountingSettings(owner,{company_name:'Jyoti Scaffold Private Limited',financial_year_start:'2026-01-01',closed_through:''});const beforeSites=(await pool.query('SELECT snapshot,grand_total FROM invoices WHERE id=$1',[invoice.id])).rows[0];await pool.query('UPDATE customers SET sites=$2 WHERE id=$1',[customer.id,JSON.stringify(['Future site'])]);await s.finalizeInvoice(invoice.id,owner);assert.deepEqual((await pool.query('SELECT snapshot,grand_total FROM invoices WHERE id=$1',[invoice.id])).rows[0],beforeSites);console.log('PASS: adding customer sites preserves saved invoice snapshot, total and finalization.');assert.equal((await pool.query('SELECT snapshot FROM invoices WHERE id=$1',[invoice.id])).rows[0].snapshot.document_details.payment_terms,'Within 15 days');const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});await a.saveAccountingSettings(owner,{company_name:'Jyoti Scaffold Private Limited',financial_year_start:'2026-01-01',closed_through:''});const bank=await a.saveLedger(owner,{name:'Bank',group_name:'Bank Accounts',party_details:{},is_active:true});const receipt={id:randomUUID(),type:'Receipt',date:today,narration:'Invoice payment',lines:[{ledger_id:bank.id,debit:10,credit:0},{ledger_id:ledger.id,debit:0,credit:10}],details:{receipt_invoice_id:invoice.id}};await a.postVoucher(owner,receipt);assert.equal((await a.postVoucher(owner,receipt)).repeated,true);await assert.rejects(a.postVoucher(owner,{...receipt,id:randomUUID(),lines:[{ledger_id:bank.id,debit:999999,credit:0},{ledger_id:ledger.id,debit:0,credit:999999}]}),/exceeds/);const reversed={id:randomUUID(),type:'Journal',date:today,narration:'Reverse payment',reverses_id:receipt.id,lines:receipt.lines.map(l=>({...l,debit:l.credit,credit:l.debit}))};await a.postVoucher(owner,reversed);assert.equal((await pool.query("SELECT count(*) n FROM rental_acc_vouchers v WHERE v.details->>'receipt_invoice_id'=$1 AND NOT EXISTS(SELECT 1 FROM rental_acc_vouchers r WHERE r.reverses_id=v.id)",[invoice.id])).rows[0].n,'0');

 const invoiceA=randomUUID(),invoiceB=randomUUID();
 const {deleteRecord}=await import('../src/rental/delete-record');
 const {reconcileInvoices}=await import('../src/rental/invoice-posting');
 const charge=(await pool.query('SELECT * FROM rental_acc_vouchers WHERE source_invoice_id=$1',[invoice.id])).rows[0];
 assert.equal(charge.type,'Sales');assert.equal(charge.lines.find((l:any)=>l.customer_id===customer.id).debit,charge.total);
 await assert.rejects(a.postVoucher(owner,{id:randomUUID(),type:'Journal',date:today,narration:'Remove invoice charge',reverses_id:charge.id,lines:charge.lines.map((l:any)=>({ledger_id:l.ledger_id,debit:Number(l.credit),credit:Number(l.debit)}))}),/finalized invoice charge/);
 await Promise.all([s.finalizeInvoice(invoice.id,owner),s.finalizeInvoice(invoice.id,owner)]);
 assert.equal((await pool.query('SELECT count(*) n FROM rental_acc_vouchers WHERE source_invoice_id=$1',[invoice.id])).rows[0].n,'1');
 const draft:any=await s.createInvoice({customer_id:newParty.id,period_start:'2026-01-01',period_end:'2026-01-31',gst_percent:18,notes:''});
 await assert.rejects(deleteRecord({...owner,role:'RENTAL_STAFF'},{kind:'invoice',id:draft.id,reason:'Test deletion'}),/Only the owner/);
 await deleteRecord(owner,{kind:'invoice',id:draft.id,reason:'Duplicate draft'});
 assert.equal((await deleteRecord(owner,{kind:'invoice',id:draft.id,reason:'Duplicate draft'})).repeated,true);
 await assert.rejects(deleteRecord(owner,{kind:'invoice',id:invoice.id,reason:'Delete finalized invoice'}),/Final invoices/);
 await assert.rejects(deleteRecord(owner,{kind:'customer',id:customer.id,reason:'Used customer'}),/posted transactions/);
 await assert.rejects(deleteRecord(owner,{kind:'ledger',id:bank.id,reason:'Used bank'}),/posted transactions/);
 const unused=await s.saveItem({name:'Unused deletion fixture',material_value:1,rate:1,effective_from:'2026-01-01'});
 await deleteRecord(owner,{kind:'item',id:unused.id,reason:'Unused fixture'});
 assert.equal((await pool.query('SELECT count(*) n FROM rates WHERE item_id=$1',[unused.id])).rows[0].n,'0');
 assert.equal((await pool.query("SELECT count(*) n FROM erp_audit WHERE action='RENTAL_INVOICE_DELETED' AND entity_id=$1",[draft.id])).rows[0].n,'1');
 const taxed:any=await s.createInvoice({customer_id:newParty.id,period_start:'2026-01-01',period_end:'2026-01-31',gst_percent:18,notes:''});
 await pool.query("UPDATE rental_acc_accounting_settings SET closed_through=CURRENT_DATE WHERE id=1");
 await assert.rejects(s.finalizeInvoice(taxed.id,owner),/open accounting period/);
 assert.equal((await pool.query('SELECT status FROM invoices WHERE id=$1',[taxed.id])).rows[0].status,'DRAFT');
 assert.equal((await pool.query('SELECT count(*) n FROM rental_acc_vouchers WHERE source_invoice_id=$1',[taxed.id])).rows[0].n,'0');
 await pool.query('UPDATE rental_acc_accounting_settings SET closed_through=NULL WHERE id=1');
 await s.finalizeInvoice(taxed.id,owner);
 const taxCharge=(await pool.query('SELECT * FROM rental_acc_vouchers WHERE source_invoice_id=$1',[taxed.id])).rows[0];
 assert.equal(taxCharge.lines.length,3);assert.ok(Number(taxCharge.lines.find((l:any)=>l.group_name==='Duties & Taxes').credit)>0);
 console.log('PASS: automatic balanced invoice posting, tax posting, atomic failure rollback, repeated finalization, owner-only audited draft/master deletion and used-record protection.');
 for(const [id,no,total] of [[invoiceA,'TEST/A',20000],[invoiceB,'TEST/B',10000]]){
 await pool.query("INSERT INTO invoices(id,invoice_no,customer_id,period_start,period_end,status,gst_percent,snapshot,rental_total,damage_total,subtotal,gst_amount,grand_total,finalized_at) VALUES($1,$2,$3,'2025-01-01','2025-01-01','FINAL',0,'{}', $4,0,$4,0,$4,now())",[id,no,customer.id,total]);
 }
 const simple={id:randomUUID(),entry_mode:'simple',type:'Receipt',party_ledger_id:ledger.id,bank_ledger_id:bank.id,amount:8000,date:today,narration:'Partial customer payment',details:{allocations:[{invoice_id:invoiceA,amount:8000}]}};
 assert.equal((await reconcileInvoices(owner)).posted,2);assert.equal((await reconcileInvoices(owner)).posted,0);
 const concurrent=await Promise.all([a.postVoucher(owner,simple),a.postVoucher(owner,simple)]);assert.equal(concurrent.filter(r=>r.repeated).length,1);
 let financial=await a.accountingState();let balanceA=financial.invoices.find(i=>i.id===invoiceA)!;assert.equal(balanceA.paid,'8000.00');assert.equal(balanceA.outstanding,'12000.00');assert.equal(balanceA.payment_status,'Partially Paid');
 const {partyStatement:customerStatement}=await import('../src/rental/party-ledger');
 assert.equal(Number(customerStatement(financial.vouchers,ledger.id,'1900-01-01',today).closing),Number(charge.total)+30000-8000);
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
 const {defaultChallanFormat}=await import('../src/rental/challan-format');
 const beforeChallanSettings=(await pool.query('SELECT id,snapshot,grand_total FROM invoices ORDER BY id')).rows;
 await assert.rejects(saveFormat({...owner,role:'RENTAL_STAFF'},{module:'challan',settings:defaultChallanFormat()}),/Only the owner/);
 await assert.rejects(saveFormat(owner,{module:'challan',settings:{...defaultChallanFormat(),font_size:99}}));
 await saveFormat(owner,{module:'challan',settings:{...defaultChallanFormat(),heading:'Custom challan heading',layout:'compact',footer:'Received in good condition'}});
 assert.equal((await loadFormats()).challan.heading,'Custom challan heading');
 assert.deepEqual((await pool.query('SELECT id,snapshot,grand_total FROM invoices ORDER BY id')).rows,beforeChallanSettings);
 const customPdf=await challanExport(siteRows[0].id);assert.ok(customPdf.bytes.length>1000);
 console.log('PASS: owner-only challan formats persist, print successfully and leave invoice records unchanged.');
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
 const {cancelVoucher}=await import('../src/rental/cancel-voucher');
 const cancelOriginal=(await pool.query("SELECT * FROM rental_acc_vouchers v WHERE source_invoice_id IS NULL AND reverses_id IS NULL AND NOT EXISTS(SELECT 1 FROM rental_acc_vouchers r WHERE r.reverses_id=v.id) ORDER BY created_at LIMIT 1")).rows[0];
 const cancellation={id:cancelOriginal.id,submission_id:randomUUID(),date:new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'}),reason:'Test cancellation'};
 await assert.rejects(cancelVoucher({...owner,role:'RENTAL_STAFF'},cancellation),/Only the owner/);
 await cancelVoucher(owner,cancellation);await cancelVoucher(owner,cancellation);
 assert.equal((await pool.query('SELECT count(*) FROM rental_acc_vouchers WHERE reverses_id=$1',[cancelOriginal.id])).rows[0].count,'1');
 await assert.rejects(cancelVoucher(owner,{...cancellation,submission_id:randomUUID()}),/already been reversed/);
 console.log('PASS: owner-only cancellation and duplicate retry protection.');


 // Company consolidation with independent site stock and billing periods.
 const multi=await s.saveCustomer({name:'Safety Rise site regression',locking_days:0});
 const move={customer_id:multi.id,date:'2026-08-01',type:'DISPATCH',lines:[{item_id:item.id,quantity:1000,rental_rate:1}]};
 await s.saveMovement(move);
 const bill={customer_id:multi.id,period_start:'2026-08-01',period_end:'2026-08-31',gst_percent:0};
 const legacyInvoice:any=await s.createInvoice(bill);

 // Simulate an unchanged historical legacy invoice without the new scope marker.
 await pool.query("UPDATE invoices SET snapshot=snapshot-'billing_scope' WHERE id=$1",[legacyInvoice.id]);
 await s.finalizeInvoice(legacyInvoice.id,owner);const frozen=(await pool.query('SELECT * FROM invoices WHERE id=$1',[legacyInvoice.id])).rows[0];
 await s.saveCustomer({id:multi.id,name:'Safety Rise site regression',locking_days:0,sites:['Odisha','Gujarat']});
 await assert.rejects(s.saveMovement({...move,site_name:'Odisha',type:'RETURN',lines:[{item_id:item.id,quantity:1}]}),/only 0/);
 await s.saveMovement({...move,site_name:'Odisha',lines:[{item_id:item.id,quantity:10,rental_rate:2}]});
 await s.saveMovement({...move,site_name:'Gujarat',lines:[{item_id:item.id,quantity:5,rental_rate:3}]});
 await assert.rejects(s.createInvoice(bill),/overlap/i);
 const nextBill={...bill,period_start:'2026-09-01',period_end:'2026-09-30'};
 assert.equal(Number((await s.createInvoice({...nextBill,site_name:'Odisha'},true) as any).grand_total),600);
 assert.equal(Number((await s.createInvoice({...nextBill,site_name:'Gujarat'},true) as any).grand_total),450);
 assert.equal(Number((await s.createInvoice({...nextBill,site_name:''},true) as any).grand_total),30000);
 const combined:any=await s.createInvoice(nextBill);
 const snap=(await pool.query('SELECT snapshot FROM invoices WHERE id=$1',[combined.id])).rows[0].snapshot;
 assert.equal(snap.billing_scope,'company');assert.equal(Number(snap.grand_total),31050);
 assert.equal(snap.lines.reduce((n:number,l:any)=>n+Number(l.quantity),0),1015);
 await s.finalizeInvoice(combined.id,owner);
 await assert.rejects(s.createInvoice({...nextBill,site_name:'Odisha'}),/overlap/i);
 await assert.rejects(s.saveMovement({...move,date:'2026-09-01',site_name:'Odisha'}),/finalized/);
 assert.deepEqual((await pool.query('SELECT * FROM invoices WHERE id=$1',[legacyInvoice.id])).rows[0],frozen);
 const multiLedger=(await pool.query('SELECT id FROM rental_acc_ledgers WHERE customer_id=$1',[multi.id])).rows[0].id;
 const multiReceipt={id:randomUUID(),type:'Receipt',date:today,narration:'One customer payment',lines:[{ledger_id:bank.id,debit:300,credit:0},{ledger_id:multiLedger,debit:0,credit:300}],details:{allocations:[{invoice_id:legacyInvoice.id,amount:200},{invoice_id:combined.id,amount:100}]}};
 await a.postVoucher(owner,multiReceipt);await a.postVoucher(owner,multiReceipt);
 const consolidated=await s.state(),companyInvoices=consolidated.invoices.filter((i:any)=>i.customer_id===multi.id);
 assert.equal(companyInvoices.length,2);assert.equal(companyInvoices.reduce((n:number,i:any)=>n+Number(i.grand_total),0),62050);
 assert.equal(companyInvoices.reduce((n:number,i:any)=>n+Number(i.paid),0),300);
 assert.equal(Number(consolidated.company_financials.find((f:any)=>f.customer_id===multi.id)?.balance),61750);
 await a.postVoucher(owner,{id:randomUUID(),type:'Receipt',date:today,narration:'Company advance',lines:[{ledger_id:bank.id,debit:50,credit:0},{ledger_id:multiLedger,debit:0,credit:50}],details:{}});
 const withAdvance=await s.state();assert.equal(Number(withAdvance.company_financials.find((f:any)=>f.customer_id===multi.id)?.balance),61700);
 assert.equal(withAdvance.invoices.filter((i:any)=>i.customer_id===multi.id).reduce((n:number,i:any)=>n+Number(i.paid),0),300);
 console.log('PASS: combined invoice includes legacy and both sites, carry-forward rent, historical invoices unchanged, duplicate billing blocked and company payments counted once.');
 const october={...bill,period_start:'2026-10-01',period_end:'2026-10-31'};
 const siteOnly:any=await s.createInvoice({...october,site_name:'Odisha'});await s.finalizeInvoice(siteOnly.id,owner);
 await assert.rejects(s.createInvoice(october),/overlap/i);
 await assert.rejects(s.createInvoice({...october,site_name:'Odisha'}),/overlap/i);
 assert.equal(Number((await s.createInvoice({...october,site_name:'Gujarat'},true) as any).grand_total),465);
 console.log('PASS: all-sites, named-site and legacy-only choices; site invoice blocks duplicate combined billing but permits another site.');
 if(process.argv.includes('--http')){
 const auth=await import('../src/shared/auth-server');await pool.query('UPDATE erp_users SET password_hash=$1 WHERE id=$2',[await auth.passwordHash('OnlyForLocalTest123'),owner.id]);
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3012'],{env:{...process.env,GST_LOOKUP_DISABLED:'1',SESSION_SECRET:'isolated-local-test-secret-at-least-32-characters'},stdio:'ignore',windowsHide:true});
 const baseUrl='http://127.0.0.1:3012';let ready=false;for(let i=0;i<40;i++){try{if((await fetch(baseUrl+'/login')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}assert.ok(ready,'Test server starts');
 assert.equal((await fetch(baseUrl+'/api/rental/accounting/state')).status,401);
 assert.equal((await fetch(baseUrl+'/api/rental/accounting/formats')).status,401);
 assert.equal((await fetch(baseUrl+'/api/rental/accounting/party-ledger')).status,401);

 const login=await fetch(baseUrl+'/api/shared/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:baseUrl},body:JSON.stringify({login:'owner',password:'OnlyForLocalTest123'})});assert.equal(login.status,200);const cookie=login.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');const headers={Cookie:cookie};
 const invoiceXlsx=await fetch(baseUrl+'/api/invoices/'+invoice.id+'/xlsx',{headers});assert.equal(invoiceXlsx.status,200);assert.ok(invoiceXlsx.headers.get('content-type')?.includes('spreadsheetml'));const exported=new ExcelJS.Workbook();await exported.xlsx.load(Buffer.from(await invoiceXlsx.arrayBuffer()) as any);assert.ok(exported.getWorksheet('Payment history'));
 assert.equal((await fetch(baseUrl+'/api/rental/accounting/challan/'+batchRows[0].id,{headers})).status,200);
 assert.equal((await fetch(baseUrl+'/api/rental/accounting/challan/'+batchRows[0].id)).status,401);
 assert.equal((await fetch(baseUrl+'/rental/accounting',{headers})).status,200);assert.equal((await fetch(baseUrl+'/api/manufacturing/state',{headers})).status,410);assert.equal((await fetch(baseUrl+'/manufacturing',{headers,redirect:'manual'})).headers.get('location'),'/rental');
 assert.equal((await fetch(baseUrl+'/api/rental/accounting/state',{headers})).status,200);assert.equal((await fetch(baseUrl+'/api/rental/gst?gstin='+gst,{headers})).status,503);
 const voucherPdf=await fetch(baseUrl+'/api/rental/accounting/vouchers/'+receipt.id+'/pdf',{headers});assert.equal(voucherPdf.status,200);assert.equal(voucherPdf.headers.get('content-type'),'application/pdf');assert.equal((await fetch(baseUrl+'/api/rental/accounting/vouchers/'+receipt.id+'/pdf')).status,401);
 const pdf=await fetch(baseUrl+'/api/rental/material-ledger?'+new URLSearchParams({customer:customer.id,start:'2026-01-01',end:'2026-01-31',format:'pdf'}),{headers});assert.equal(pdf.status,200);assert.equal(pdf.headers.get('content-type'),'application/pdf');
 await auth.saveUser(owner,{name:'Rental test',login:'rental',role:'RENTAL_STAFF',is_active:true,password:'OnlyForLocalTest123'});const r=await fetch(baseUrl+'/api/shared/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:baseUrl},body:JSON.stringify({login:'rental',password:'OnlyForLocalTest123'})});const staffCookie=r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');assert.equal((await fetch(baseUrl+'/api/rental/accounting/state',{headers:{Cookie:staffCookie}})).status,200);assert.equal((await fetch(baseUrl+'/api/shared/users',{headers:{Cookie:staffCookie}})).status,403);
 assert.equal((await fetch(baseUrl+'/api/rental/accounting/movements',{method:'POST',headers:{Cookie:staffCookie,'Content-Type':'application/json',Origin:baseUrl},body:JSON.stringify({})})).status,403);
 assert.equal((await fetch(baseUrl+'/api/rental/accounting/formats',{method:'POST',headers:{Cookie:staffCookie,'Content-Type':'application/json',Origin:baseUrl},body:JSON.stringify({})})).status,403);
 assert.equal((await fetch(baseUrl+'/api/rental/accounting/movement-history',{headers:{Cookie:staffCookie}})).status,403);
 assert.equal((await fetch(baseUrl+'/api/rental/accounting/cancel-voucher',{method:'POST',headers:{Cookie:staffCookie,'Content-Type':'application/json',Origin:baseUrl},body:JSON.stringify(cancellation)})).status,403);
 for(const action of ['delete-record','reconcile-invoices'])assert.equal((await fetch(baseUrl+'/api/rental/accounting/'+action,{method:'POST',headers:{Cookie:staffCookie,'Content-Type':'application/json',Origin:baseUrl},body:'{}'})).status,403);
 assert.equal((await fetch(baseUrl+'/api/rental/accounting/movement-history',{headers})).status,200);
 assert.equal((await fetch(baseUrl+'/api/rental/accounting/party-ledger?'+new URLSearchParams({ledger:ledger.id,start:'1900-01-01',end:today,format:'pdf'}),{headers})).status,200);
 console.log('PASS: HTTP authentication, rental staff accounting, owner-only access, manufacturing retirement, GST not-configured response and PDF download.');
 }
 console.log('PASS: GST checksum/uniqueness, atomic customer-ledger sync, protected linkage, inward/outward/opening balances, PDF/Excel exports, receipt idempotency, overpayment rejection and reversal.');
}finally{server?.kill();await pool.end();await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);await admin.end();}
