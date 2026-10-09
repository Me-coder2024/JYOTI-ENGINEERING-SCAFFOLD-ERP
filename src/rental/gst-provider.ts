import {AccessError} from '@/shared/access';
import {normalizePortalDetails} from './gst-live';
export function providerKeys(){return [...new Set((process.env.GSTINCHECK_API_KEYS||process.env.GSTINCHECK_API_KEY||'').split(',').map(s=>s.trim()).filter(Boolean))].slice(0,3);}
export async function lookupProvider(gstin:string){
 const keys=providerKeys();
 if(!keys.length)return null;
 for(const key of keys){
  let response:Response;
  try{response=await fetch('https://sheet.gstincheck.co.in/check/'+encodeURIComponent(key)+'/'+encodeURIComponent(gstin),{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)});}catch{continue;}
  if(response.status===429||response.status>=500||[401,403].includes(response.status)){await response.body?.cancel();continue;}
  if(!response.ok){await response.body?.cancel();throw new AccessError('GSTINCheck rejected the lookup. Check the GSTIN before retrying.',502);}
  let result;try{result=await response.json();}catch{continue;}
  if(result.flag===true)return normalizePortalDetails(result.data,gstin);
  // Only provider availability/credential/quota failures may move to a configured backup.
  // Never expose provider messages: they may include the API key from the request URL.
  const message=String(result.message||'').toLowerCase();
  if(/limit|quota|credit|expired|api.?key|unauthori|subscription|balance|unavailable|try again|server|timeout/.test(message))continue;
  throw new AccessError('GSTINCheck could not find or verify this GSTIN. Check the number or use the official GST search.',400);
 }
 throw new AccessError('GSTINCheck is unavailable, or the configured keys have no remaining allowance. Check provider credits or use the official GST search/import option.',503);
}
