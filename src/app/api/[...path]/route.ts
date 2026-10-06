import {materialExport} from '@/rental/material-export';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authenticated, createSession, validPassword } from '@/lib/auth';
import * as service from '@/lib/service';
import { pool } from '@/lib/db';
import { makePdf, makeExcel } from '@/lib/documents';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const attempts=new Map<string,{count:number,until:number}>();
export async function GET(req:NextRequest,{params}:{params:Promise<{path:string[]}>}) {
 try {
  if(!await authenticated()) return NextResponse.json({error:'Please sign in.'},{status:401});
  const path=(await params).path;
  if(path[0]==='state') return NextResponse.json(await service.state());
  if(path[0]==='invoices' && path[1]) {
   const invoice=(await pool.query('SELECT * FROM invoices WHERE id=$1',[path[1]])).rows[0];
   if(!invoice) return NextResponse.json({error:'Invoice not found.'},{status:404});
   invoice.payments=(await pool.query("SELECT v.voucher_no,v.date,v.total FROM rental_acc_vouchers v WHERE v.details->>'receipt_invoice_id'=$1 AND NOT EXISTS(SELECT 1 FROM rental_acc_vouchers r WHERE r.reverses_id=v.id) ORDER BY v.date,v.created_at",[invoice.id])).rows;
   if(path[2]==='pdf') return new Response(new Uint8Array(await makePdf(invoice)),{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${invoice.invoice_no.replaceAll('/','-')}.pdf"`}});
   return NextResponse.json(invoice);
  }
  if(path[0]==='quotations'&&path[1]) {
    const quote=(await pool.query('SELECT * FROM quotations WHERE id=$1',[path[1]])).rows[0];
    if(!quote) return NextResponse.json({error:'Quotation not found.'},{status:404});
    return new Response(new Uint8Array(await makePdf(quote,true)),{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="quotation.pdf"'}});
  }
  if(path[0]==='export') {
   const result=path[1]==='ledger'?(await materialExport(new URLSearchParams({customer:req.nextUrl.searchParams.get('customer')||'',start:req.nextUrl.searchParams.get('start')||'1900-01-01',end:req.nextUrl.searchParams.get('end')||new Date().toISOString().slice(0,10),format:'xlsx'}))).bytes:await makeExcel(path[1]);
   return new Response(new Uint8Array(result),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="jyoti-${path[1]}.xlsx"`}});
  }
  return NextResponse.json({error:'Not found.'},{status:404});
 } catch(error) {console.error(error);return NextResponse.json({error:error instanceof Error?error.message:'Unable to load data.'},{status:400});}
}
export async function POST(req:NextRequest,{params}:{params:Promise<{path:string[]}>}) {
 try {
  const origin=req.headers.get('origin');
  // Next can normalize nextUrl to localhost even when a request used 127.0.0.1.
  // Compare the browser's actual Origin with the actual Host, never forwarded headers.
  if(origin && (!/^https?:\/\//.test(origin)||new URL(origin).host!==req.headers.get('host'))) return NextResponse.json({error:'Untrusted request origin.'},{status:403});
  const path=(await params).path;
  if(path[0]==='logout') { (await cookies()).delete('jyoti_session');return NextResponse.json({ok:true}); }
  if(path[0]==='login') {
   const key='office',now=Date.now(),attempt=attempts.get(key);
   if(attempt && attempt.until>now && attempt.count>=10) return NextResponse.json({error:'Too many attempts. Try again in 15 minutes.'},{status:429});
   const body=await req.json();
   if(typeof body.password!=='string'||!validPassword(body.password)) {
    attempts.set(key,{count:attempt&&attempt.until>now?attempt.count+1:1,until:attempt&&attempt.until>now?attempt.until:now+900000});
    return NextResponse.json({error:'Incorrect office password.'},{status:401});
   }
   attempts.delete(key);
   (await cookies()).set('jyoti_session',createSession(),{httpOnly:true,sameSite:'strict',secure:req.nextUrl.protocol==='https:',maxAge:43200,path:'/'});
   return NextResponse.json({ok:true});
  }
  if(!await authenticated()) return NextResponse.json({error:'Please sign in.'},{status:401});
  const data=await req.json();
  let result;
  if(path[0]==='customers') result=await service.saveCustomer(data);
  else if(path[0]==='items') result=await service.saveItem(data);
  else if(path[0]==='movements') result=await service.saveMovement(data,path[1]==='preview');
  else if(path[0]==='invoices'&&path[2]==='finalize') result=await service.finalizeInvoice(path[1]);
  else if(path[0]==='invoices'&&path[1]&&path[1]!=='preview') result=await service.updateInvoice(path[1],data);
  else if(path[0]==='invoices') result=await service.createInvoice(data,path[1]==='preview');
  else if(path[0]==='company') result=await service.saveCompany(data);
  else if(path[0]==='quotations') result=await service.saveQuotation(data);
  else return NextResponse.json({error:'Not found.'},{status:404});
  return NextResponse.json(result);
 } catch(error) {
  console.error(error);
  const e=error as {code?:string;message?:string;issues?:{message:string;path:string[]}[]};
  const message=e.code==='23505'?(pathError(error)==='customers_unique_gstin'?'This GST number already belongs to another customer. Open the existing profile.':'This record or effective rate date already exists.'):e.issues?e.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; '):e.message||'Unable to save. Try again.';
  return NextResponse.json({error:message},{status:400});
 }
}

function pathError(e:unknown){return (e as {constraint?:string}).constraint;}
