import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lookupProvider,providerKeys} from '../src/rental/gst-provider';
test('GST provider direct lookup, bounded backup keys, terminal errors and secret redaction',async()=>{
 const original=globalThis.fetch,old=process.env.GSTINCHECK_API_KEYS,oldSingle=process.env.GSTINCHECK_API_KEY;
 const gstin='09FBMPA8295P1ZM',details={gstin,lgnm:'Test Company',pradr:{adr:'Test address'},sts:'Active',dty:'Regular'};
 try{
  process.env.GSTINCHECK_API_KEYS='primary,backup,backup';assert.deepEqual(providerKeys(),['primary','backup']);
  let calls=0;globalThis.fetch=(async()=>{calls++;return calls===1?new Response('',{status:503}):Response.json({flag:true,data:details});}) as typeof fetch;
  assert.equal((await lookupProvider(gstin))?.name,'Test Company');assert.equal(calls,2);
  calls=0;globalThis.fetch=(async()=>{calls++;return Response.json({flag:false,message:'GSTIN not found'});}) as typeof fetch;
  await assert.rejects(()=>lookupProvider(gstin),/could not find or verify/);assert.equal(calls,1);
  calls=0;globalThis.fetch=(async()=>{calls++;return Response.json({flag:false,message:'API key primary credit limit reached'});}) as typeof fetch;
  await assert.rejects(()=>lookupProvider(gstin),e=>e instanceof Error&&!e.message.includes('primary')&&e.message.includes('remaining allowance'));assert.equal(calls,2);
  globalThis.fetch=(async()=>Response.json({flag:true,data:{...details,gstin:'OTHER'}})) as typeof fetch;
  await assert.rejects(()=>lookupProvider(gstin),/matching details/);
  delete process.env.GSTINCHECK_API_KEYS;delete process.env.GSTINCHECK_API_KEY;assert.equal(await lookupProvider(gstin),null);
 }finally{globalThis.fetch=original;if(old===undefined)delete process.env.GSTINCHECK_API_KEYS;else process.env.GSTINCHECK_API_KEYS=old;if(oldSingle===undefined)delete process.env.GSTINCHECK_API_KEY;else process.env.GSTINCHECK_API_KEY=oldSingle;}
});
