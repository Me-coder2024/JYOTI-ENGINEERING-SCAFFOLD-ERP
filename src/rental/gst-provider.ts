import {AccessError} from '@/shared/access';
import {normalizePortalDetails} from './gst-live';
export function providerKeys(){return [...new Set((process.env.GSTINCHECK_API_KEYS||process.env.GSTINCHECK_API_KEY||'').split(',').map(s=>s.trim()).filter(Boolean))].slice(0,3);}
export async function lookupProvider(gstin:string){
 const keys=providerKeys();
 const backup=process.env.GSTINAPI_API_KEY?.trim();
 if(!keys.length&&!backup)return null;
 for(const key of keys){
  let response:Response;
  try{response=await fetch('https://sheet.gstincheck.co.in/check/'+encodeURIComponent(key)+'/'+encodeURIComponent(gstin),{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)});}catch{continue;}
  if(response.status===429||response.status>=500||[401,402,403].includes(response.status)){await response.body?.cancel();continue;}
  if(!response.ok){await response.body?.cancel();throw new AccessError('GSTINCheck rejected the lookup. Check the GSTIN before retrying.',502);}
  let result;try{result=await response.json();}catch{continue;}
  if(result.flag===true)return normalizePortalDetails(result.data,gstin);
  // Only provider availability/credential/quota failures may move to a configured backup.
  // Never expose provider messages: they may include the API key from the request URL.
  const message=String(result.message||'').toLowerCase();
  if(/limit|quota|credit|expired|api.?key|unauthori|subscription|balance|unavailable|try again|server|timeout/.test(message))continue;
  throw new AccessError('GSTINCheck could not find or verify this GSTIN. Check the number or use the official GST search.',400);
 }
 if(backup)return lookupGstinApi(gstin,backup);
 throw new AccessError('GSTINCheck is unavailable, or the configured keys have no remaining allowance. Check provider credits or use the official GST search/import option.',503);
}

async function lookupGstinApi(gstin:string,key:string){
 let response:Response;
 try{response=await fetch('https://www.gstinapi.in/v1/gstin/'+encodeURIComponent(gstin),{headers:{'x-api-key':key},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)});}catch{throw new AccessError('GST providers could not be reached. Try later or use official search/import.',503);}
 if(!response.ok){const status=response.status;await response.body?.cancel();
  if(status===400||status===404)throw new AccessError('GSTINAPI could not verify this GSTIN. Check the number.',400);
  if(status===402)throw new AccessError('GSTINAPI backup credits are exhausted. Check your provider allowance or use official search/import.',503);
  if(status===401||status===403)throw new AccessError('GSTINAPI backup key was rejected. Check the server configuration.',503);
  throw new AccessError('GSTINAPI backup is temporarily unavailable. Try later or use official search/import.',503);
 }
 let result;try{result=await response.json();}catch{throw new AccessError('GSTINAPI returned an unreadable response. Try later.',502);}
 if(result.success!==true)throw new AccessError('GSTINAPI did not verify the GSTIN. Use official search/import.',502);
 const d=result.data;
 return normalizePortalDetails({gstin:d?.gstin,lgnm:d?.legal_name,tradeNam:d?.trade_name,sts:d?.status,dty:d?.taxpayer_type,pradr:{adr:d?.address}},gstin);
}
