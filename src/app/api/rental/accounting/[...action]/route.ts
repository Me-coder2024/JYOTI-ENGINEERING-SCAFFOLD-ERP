import {NextRequest} from 'next/server';
import {requireApi,sameOrigin,errorResponse} from '@/shared/guards';
import * as accounting from '@/rental/accounting';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest,{params}:{params:Promise<{action:string[]}>}){try{await requireApi(req,'rental');const path=(await params).action;if(path[0]==='state')return Response.json(await accounting.accountingState(),{headers:{'Cache-Control':'private, no-store'}});return Response.json({error:'Not found.'},{status:404});}catch(e){return errorResponse(e);}}
export async function POST(req:NextRequest,{params}:{params:Promise<{action:string[]}>}){try{sameOrigin(req);const user=await requireApi(req,'rental'),path=(await params).action,data=await req.json();let result;
 switch(path[0]){case 'ledgers':result=await accounting.saveLedger(user,data);break;case 'vouchers':result=await accounting.postVoucher(user,data);break;case 'settings':result=await accounting.saveAccountingSettings(user,data);break;default:return Response.json({error:'Not found.'},{status:404});}return Response.json(result);}catch(e){return errorResponse(e);}}
