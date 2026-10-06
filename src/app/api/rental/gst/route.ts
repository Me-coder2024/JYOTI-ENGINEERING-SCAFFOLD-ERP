import {NextRequest} from 'next/server';
import {requireApi,errorResponse} from '@/shared/guards';
import {validGstin} from '@/rental/gst';
export async function GET(req:NextRequest){try{await requireApi(req,'rental');const gstin=(req.nextUrl.searchParams.get('gstin')||'').trim().toUpperCase();if(!validGstin(gstin))return Response.json({error:'Invalid GSTIN.'},{status:400});
 // A provider adapter must return normalized name/address/state_code fields.
 const endpoint=process.env.GST_LOOKUP_URL,key=process.env.GST_LOOKUP_KEY;if(!endpoint||!key)return Response.json({error:'GST lookup is not connected yet. Enter details manually; GST validation and duplicate protection still apply.'},{status:503});
 const url=new URL(endpoint);if(url.protocol!=='https:')throw new Error('GST provider requires HTTPS.');url.searchParams.set('gstin',gstin);const r=await fetch(url,{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(10000),cache:'no-store',redirect:'error'});if(!r.ok)return Response.json({error:'GST provider could not return details. Try later or enter them manually.'},{status:502});const d=await r.json();if(typeof d.name!=='string'||typeof d.address!=='string'||d.state_code!==gstin.slice(0,2))return Response.json({error:'GST provider returned incomplete details.'},{status:502});return Response.json({name:d.name.slice(0,200),address:d.address.slice(0,2000),state_code:d.state_code},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return errorResponse(e);}}
