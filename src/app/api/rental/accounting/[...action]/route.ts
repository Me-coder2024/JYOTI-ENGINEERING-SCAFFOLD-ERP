import {pool} from '@/lib/db';
import {voucherPdf} from '@/rental/print-documents';
import {z} from 'zod';
import {NextRequest} from 'next/server';
import {requireApi,sameOrigin,errorResponse} from '@/shared/guards';
import * as accounting from '@/rental/accounting';
import {correctMovement} from '@/rental/movement-corrections';
import {loadFormats,saveFormat} from '@/rental/ledger-format-service';
import {partyExport} from '@/rental/party-export';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest,{params}:{params:Promise<{action:string[]}>}){
 try{
  await requireApi(req,'rental');
  const path=(await params).action;
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
  if(['movements','formats'].includes(path[0]))await requireApi(req,'owner');
  const data=await req.json();let result;
  switch(path[0]){
   case 'movements':result=await correctMovement(user,data);break;
   case 'formats':result=await saveFormat(user,data);break;
   case 'ledgers':result=await accounting.saveLedger(user,data);break;
   case 'vouchers':result=await accounting.postVoucher(user,data);break;
   case 'settings':result=await accounting.saveAccountingSettings(user,data);break;
   default:return Response.json({error:'Not found.'},{status:404});
  }
  return Response.json(result);
 }catch(e){return errorResponse(e);}
}
