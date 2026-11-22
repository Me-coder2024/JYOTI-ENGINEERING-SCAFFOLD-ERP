import {correctChallan} from '@/rental/challan-corrections';
import {authorizeRequest} from '@/shared/request-access';
import {movementExport} from '@/rental/movement-export';
import {pool} from '@/lib/db';
import {voucherPdf} from '@/rental/print-documents';
import {z} from 'zod';
import {NextRequest} from 'next/server';
import {requireApi,sameOrigin,errorResponse} from '@/shared/guards';
import * as accounting from '@/rental/accounting';
import {correctMovement} from '@/rental/movement-corrections';
import {loadFormats,saveFormat} from '@/rental/ledger-format-service';
import {partyExport} from '@/rental/party-export';
import {cancelVoucher} from '@/rental/cancel-voucher';
import {challanExport} from '@/rental/challan-export';
import {deleteRecord} from '@/rental/delete-record';
import {reconcileInvoices} from '@/rental/invoice-posting';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest,{params}:{params:Promise<{action:string[]}>}){
 try{
  const user=await requireApi(req,'rental');
  authorizeRequest(user,req.nextUrl.pathname,'GET');
  const path=(await params).action;
  if(path[0]==='challan'&&path[1]){const out=await challanExport(path[1]);return new Response(new Uint8Array(out.bytes),{headers:{'Content-Type':out.type,'Content-Disposition':'inline; filename="challan.pdf"','Cache-Control':'private, no-store'}});}
  if(path[0]==='movement-export'){
   const out=await movementExport(req.nextUrl.searchParams);
   return new Response(new Uint8Array(out.bytes),{headers:{'Content-Type':out.type,'Content-Disposition':(out.extension==='pdf'?'inline':'attachment')+'; filename="movement-history.'+out.extension+'"','Cache-Control':'private, no-store'}});
  }
  if(path[0]==='formats')return Response.json(await loadFormats(),{headers:{'Cache-Control':'private, no-store'}});
  if(path[0]==='party-ledger'){
   const out=await partyExport(req.nextUrl.searchParams);
   return new Response(new Uint8Array(out.bytes),{headers:{'Content-Type':out.type,'Content-Disposition':(out.extension==='pdf'?'inline':'attachment')+'; filename="party-ledger.'+out.extension+'"','Cache-Control':'private, no-store'}});
  }
  if(path[0]==='movement-history'){
   await requireApi(req,'owner');
   return Response.json((await pool.query('SELECT r.*,u.name AS actor FROM rental_movement_revisions r JOIN erp_users u ON u.id=r.user_id ORDER BY r.id DESC LIMIT 500')).rows,{headers:{'Cache-Control':'private, no-store'}});
  }
  if(path.length===3&&path[0]==='vouchers'&&path[2]==='pdf'){
   const id=z.string().uuid().parse(path[1]);const voucher=(await pool.query('SELECT * FROM rental_acc_vouchers WHERE id=$1',[id])).rows[0];
   if(!voucher)return Response.json({error:'Voucher not found.'},{status:404});
   const company=(await pool.query('SELECT * FROM company WHERE id=1')).rows[0];
   return new Response(Buffer.from(await voucherPdf(voucher,company)),{headers:{'Content-Type':'application/pdf','Content-Disposition':'inline; filename="voucher.pdf"','Cache-Control':'private, no-store'}});
  }
  if(path[0]==='state')return Response.json(await accounting.accountingState(),{headers:{'Cache-Control':'private, no-store'}});
  return Response.json({error:'Not found.'},{status:404});
 }catch(e){return errorResponse(e);}
}
export async function POST(req:NextRequest,{params}:{params:Promise<{action:string[]}>}){
 try{
  sameOrigin(req);
  const user=await requireApi(req,'rental');
  const path=(await params).action;

  const data=await req.json();authorizeRequest(user,req.nextUrl.pathname,'POST',data);let result;
  switch(path[0]){
   case 'delete-record':result=await deleteRecord(user,data);break;
   case 'reconcile-invoices':result=await reconcileInvoices(user);break;
   case 'cancel-voucher':result=await cancelVoucher(user,data);break;
   case 'challans':result=await correctChallan(user,data);break;
   case 'movements':return Response.json({error:'Use Edit Challan.'},{status:403});
   case 'formats':result=await saveFormat(user,data);break;
   case 'ledgers':result=await accounting.saveLedger(user,data);break;
   case 'vouchers':result=await accounting.postVoucher(user,data);break;
   case 'settings':result=await accounting.saveAccountingSettings(user,data);break;
   default:return Response.json({error:'Not found.'},{status:404});
  }
  return Response.json(result);
 }catch(e){return errorResponse(e);}
}
