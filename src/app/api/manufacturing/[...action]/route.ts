import {NextRequest,NextResponse} from 'next/server';
import {requireApi,sameOrigin,errorResponse} from '@/shared/guards';
import * as mfg from '@/manufacturing/service';
import * as production from '@/manufacturing/production';
import {manufacturingPdf} from '@/manufacturing/pdf';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest,{params}:{params:Promise<{action:string[]}>}){try{await requireApi(req,'manufacturing');const path=(await params).action;if(path[0]==='state')return NextResponse.json({...await mfg.getState(),...await production.productionState()});if(path[0]==='documents'&&path[1]&&path[2]){const record=await mfg.getDocument(path[1],path[2]);return new Response(new Uint8Array(await manufacturingPdf(path[1],record)),{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${path[1]}-${record.id.slice(0,8)}.pdf"`}});}return NextResponse.json({error:'Not found.'},{status:404});}catch(e){return errorResponse(e);}}
export async function POST(req:NextRequest,{params}:{params:Promise<{action:string[]}>}){try{sameOrigin(req);const user=await requireApi(req,'manufacturing'),path=(await params).action,data=await req.json();let result;
 if(path[0]==='masters')result=path[2]==='remove'?await mfg.removeMaster(user,path[1],data.id):await mfg.saveMaster(user,path[1],data);
 else if(path[0]==='orders')result=path[2]?await mfg.transitionOrder(user,path[1],data.id,path[2]):await mfg.saveOrder(user,path[1],data);
 else if(path[0]==='movements')result=await mfg.postMovement(user,path[1],data);
 else if(path[0]==='boms')result=await production.saveBom(user,data);
 else if(path[0]==='workorders')result=path[1]==='transition'?await production.transitionWorkOrder(user,data):await production.saveWorkOrder(user,data);
 else if(path[0]==='production')result=await production.postProduction(user,data);
 else if(path[0]==='opening-stock')result=await mfg.openingStock(user,data);
 else if(path[0]==='invoices')result=await mfg.issueInvoice(user,data);
 else return NextResponse.json({error:'Not found.'},{status:404});return NextResponse.json(result);
 }catch(e){return errorResponse(e);}}
