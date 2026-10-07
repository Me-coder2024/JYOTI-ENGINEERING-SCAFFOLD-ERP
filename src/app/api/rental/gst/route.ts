import {NextRequest} from 'next/server';
import {requireApi,errorResponse} from '@/shared/guards';
import {validGstin} from '@/rental/gst';
export async function GET(req:NextRequest){try{await requireApi(req,'rental');const gstin=(req.nextUrl.searchParams.get('gstin')||'').trim().toUpperCase();if(!validGstin(gstin))return Response.json({error:'Invalid GSTIN.'},{status:400});return Response.json({error:'Automatic GST fetching is not enabled. Use the free official GST search and import the copied result in the customer form.',verification_url:'https://services.gst.gov.in/services/searchtp'},{status:503,headers:{'Cache-Control':'private, no-store'}});}catch(e){return errorResponse(e);}}
