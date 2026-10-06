import {NextRequest} from 'next/server';
import {requireApi,errorResponse} from '@/shared/guards';
import {materialExport} from '@/rental/material-export';
export async function GET(req:NextRequest){try{await requireApi(req,'rental');const result=await materialExport(req.nextUrl.searchParams);return new Response(new Uint8Array(result.bytes),{headers:{'Content-Type':result.type,'Content-Disposition':`${result.extension==='pdf'?'inline':'attachment'}; filename="material-ledger.${result.extension}"`,'Cache-Control':'private, no-store'}});}catch(e){return errorResponse(e);}}
