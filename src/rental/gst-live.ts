import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
import {AccessError} from '@/shared/access';
const base='https://services.gst.gov.in/services';
function key(){const s=process.env.SESSION_SECRET;if(!s||s.length<32)throw new AccessError('GST lookup requires the server session secret to be configured.',503);return createHash('sha256').update('gst-session:'+s).digest();}
export function sealGstSession(value:{user:string;gstin:string;cookies:string;expires:number}){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv);const body=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),body]).toString('base64url');}
export function openGstSession(token:string,user:string,gstin:string){try{const b=Buffer.from(token,'base64url'),cipher=createDecipheriv('aes-256-gcm',key(),b.subarray(0,12));cipher.setAuthTag(b.subarray(12,28));const d=JSON.parse(Buffer.concat([cipher.update(b.subarray(28)),cipher.final()]).toString());if(d.user!==user||d.gstin!==gstin||d.expires<Date.now()||typeof d.cookies!=='string')throw Error();return d as {cookies:string};}catch{throw new AccessError('This CAPTCHA expired or belongs to another GSTIN. Load a new CAPTCHA.',400);}}
function cookies(previous:string,response:Response){const jar=new Map(previous.split('; ').filter(Boolean).map(v=>{const i=v.indexOf('=');return [v.slice(0,i),v.slice(i+1)];}));for(const v of response.headers.getSetCookie()){const pair=v.split(';')[0],i=pair.indexOf('=');jar.set(pair.slice(0,i),pair.slice(i+1));}return [...jar].map(([k,v])=>k+'='+v).join('; ');}
async function request(path:string,options:RequestInit={}){
 const stage=path==='/searchtp'?'opening the GST search':path==='/captcha'?'loading the CAPTCHA':'submitting the taxpayer lookup';
 const attempts=options.method==='POST'?1:2;
 for(let attempt=0;attempt<attempts;attempt++){
  let response:Response;
  try{response=await fetch(base+path,{...options,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});}
  catch(error){
   if(attempt+1<attempts)continue;
   const timedOut=error instanceof Error&&['TimeoutError','AbortError'].includes(error.name);
   console.warn('GST upstream failure',{stage,reason:timedOut?'timeout':'connection'});
   throw new AccessError(`GST portal ${timedOut?'timed out':'could not be reached'} while ${stage}. Retry with a fresh CAPTCHA or use the official search/import option.`,502);
  }
  if(response.ok)return response;
  const status=response.status;
  await response.body?.cancel();
  if(status>=500&&attempt+1<attempts)continue;
  console.warn('GST upstream failure',{stage,status});
  const reason=status===403?'refused this server request':status===429?'limited requests':status===400?'rejected the request; the CAPTCHA may be invalid or expired':`returned HTTP ${status}`;
  throw new AccessError(`GST portal ${reason} while ${stage}. Use a fresh CAPTCHA or the official search/import option.`,502);
 }
 throw new AccessError('GST connection failed. Please retry.',502);
}
export async function gstChallenge(user:string,gstin:string){const page=await request('/searchtp'),session=cookies('',page);const image=await request('/captcha',{headers:{Cookie:session,Referer:base+'/searchtp'}}),type=image.headers.get('content-type')||'';if(!type.startsWith('image/'))throw new AccessError('The GST portal did not provide a CAPTCHA. Please retry later.',502);const bytes=Buffer.from(await image.arrayBuffer());if(bytes.length>200000||bytes.length<30||!['image/png','image/jpeg'].includes(type.split(';')[0]))throw new AccessError('Invalid CAPTCHA response from GST portal.',502);return {image:'data:'+type.split(';')[0]+';base64,'+bytes.toString('base64'),token:sealGstSession({user,gstin,cookies:cookies(session,image),expires:Date.now()+5*60000})};}
export function normalizePortalDetails(raw:any,gstin:string){const d=raw?.data&&typeof raw.data==='object'?raw.data:raw;if(!d||d.gstin!==gstin||typeof d.lgnm!=='string'||!d.lgnm.trim()||typeof d.pradr?.adr!=='string')throw new AccessError('GST lookup did not return matching details. Check the GSTIN and try a fresh CAPTCHA.',400);const kind=['Regular','Composition'].includes(d.dty)?d.dty:'Unknown';return {name:String(d.tradeNam||d.lgnm).slice(0,2000),mailing_name:d.lgnm.slice(0,2000),address:d.pradr.adr.replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]*>/g,'').slice(0,2000),state_code:gstin.slice(0,2),country:'India',gst_registration:kind,registration_status:String(d.sts||'Unknown').slice(0,50)};}
export async function lookupPortal(user:string,gstin:string,token:string,captcha:string){const session=openGstSession(token,user,gstin),r=await request('/api/search/taxpayerDetails',{method:'POST',headers:{Cookie:session.cookies,Referer:base+'/searchtp','Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({gstin,captcha})});let data;try{data=await r.json();}catch{throw new AccessError('The GST portal returned an unreadable response. Please retry later.',502);}return normalizePortalDetails(data,gstin);}
