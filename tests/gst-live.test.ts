import {test} from 'node:test';import assert from 'node:assert/strict';
import {sealGstSession,openGstSession,normalizePortalDetails,lookupPortal,gstChallenge} from '../src/rental/gst-live';
test('GST sessions expire and are bound to owner and GSTIN',()=>{process.env.SESSION_SECRET='only-for-tests-not-production-123456789';const d={user:'u1',gstin:'09FBMPA8295P1ZM',cookies:'test=value',expires:Date.now()+10000};const token=sealGstSession(d);assert.equal(openGstSession(token,d.user,d.gstin).cookies,d.cookies);assert.throws(()=>openGstSession(token,'u2',d.gstin));assert.throws(()=>openGstSession(token,d.user,'24ABCDE1234F1Z1'));assert.throws(()=>openGstSession(sealGstSession({...d,expires:0}),d.user,d.gstin));assert.throws(()=>openGstSession('invalid',d.user,d.gstin));});
test('GST portal response must match GSTIN; unknown registration type is not invented',()=>{const d={gstin:'09FBMPA8295P1ZM',lgnm:'Legal Name',tradeNam:'Trade Name',pradr:{adr:'Street<br/>City'},sts:'Active',dty:'Regular'};assert.equal(normalizePortalDetails(d,d.gstin).address,'Street\nCity');assert.equal(normalizePortalDetails(d,d.gstin).mailing_name,'Legal Name');assert.throws(()=>normalizePortalDetails({error:'captcha invalid'},d.gstin));assert.throws(()=>normalizePortalDetails(d,'OTHER'));assert.equal(normalizePortalDetails({...d,dty:'Unknown type'},d.gstin).gst_registration,'Unknown');});
test('Human CAPTCHA session passes portal cookies and returns verified fields',async()=>{process.env.SESSION_SECRET='only-for-tests-not-production-123456789';const original=globalThis.fetch;const calls:{url:string;options:any}[]=[];globalThis.fetch=(async(url:any,options:any)=>{calls.push({url:String(url),options});if(String(url).endsWith('/searchtp'))return new Response('page',{headers:{'set-cookie':'gst-session=test; Path=/'}});if(String(url).endsWith('/captcha'))return new Response(new Uint8Array(40),{headers:{'content-type':'image/png'}});assert.ok(options.headers.Cookie.includes('gst-session=test'));assert.equal(JSON.parse(options.body).captcha,'ABC123');return Response.json({gstin:'09FBMPA8295P1ZM',lgnm:'Test Company',pradr:{adr:'Test address'},sts:'Active',dty:'Regular'});}) as typeof fetch;try{const challenge=await gstChallenge('u1','09FBMPA8295P1ZM');const result=await lookupPortal('u1','09FBMPA8295P1ZM',challenge.token,'ABC123');assert.equal(result.name,'Test Company');assert.equal(calls.length,3);assert.ok(calls.every(c=>c.url.startsWith('https://services.gst.gov.in/')));}finally{globalThis.fetch=original;}});

test('GST connection retries transient GET failures and identifies denied requests',async()=>{
 const original=globalThis.fetch;let calls=0;
 try{
  globalThis.fetch=(async()=>{calls++;throw new TypeError('fetch failed');}) as typeof fetch;
  await assert.rejects(()=>gstChallenge('u1','09FBMPA8295P1ZM'),/could not be reached while opening the GST search/);assert.equal(calls,2);
  calls=0;globalThis.fetch=(async()=>{calls++;return new Response('',{status:403});}) as typeof fetch;
  await assert.rejects(()=>gstChallenge('u1','09FBMPA8295P1ZM'),/refused this server request/);assert.equal(calls,1);
 }finally{globalThis.fetch=original;}
});
test('GST taxpayer submission is not replayed on upstream failure',async()=>{
 const original=globalThis.fetch;let calls=0;
 try{globalThis.fetch=(async()=>{calls++;return new Response('',{status:503});}) as typeof fetch;
 const token=sealGstSession({user:'u1',gstin:'09FBMPA8295P1ZM',cookies:'session=test',expires:Date.now()+10000});
 await assert.rejects(()=>lookupPortal('u1','09FBMPA8295P1ZM',token,'ABC123'),/HTTP 503 while submitting the taxpayer lookup/);assert.equal(calls,1);
 }finally{globalThis.fetch=original;}
});
