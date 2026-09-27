import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';
import { sessionUser } from './auth-server';
import { allowed, AccessError } from './access';
import {randomUUID} from 'node:crypto';
export async function requirePage(module:'rental'|'manufacturing'|'owner') {const user=await sessionUser((await cookies()).get('erp_session')?.value);if(!user)redirect('/login');if(!allowed(user.role,module))throw new AccessError('Access denied.',403);return user;}
export async function requireApi(req:NextRequest,module:'rental'|'manufacturing'|'owner') {const user=await sessionUser(req.cookies.get('erp_session')?.value);if(!user)throw new AccessError('Please sign in.',401);if(!allowed(user.role,module))throw new AccessError('Access denied for this module.',403);return user;}
export function sameOrigin(req:NextRequest) {const origin=req.headers.get('origin');if(origin&&(!/^https?:\/\//.test(origin)||new URL(origin).host!==req.headers.get('host')))throw new AccessError('Untrusted request origin.',403);}
export function errorResponse(error:unknown) {
 const e=error as {message?:string;status?:number;code?:string;issues?:{message:string}[]};
 if(error instanceof AccessError)return Response.json({error:error.message},{status:error.status});
 if(e.issues)return Response.json({error:e.issues.map(i=>i.message).join('; ')},{status:400});
 if(error instanceof SyntaxError)return Response.json({error:'The request could not be read. Please check the form and try again.'},{status:400});
 if(e.code==='23505')return Response.json({error:'This record already exists. Refresh the list before trying again.'},{status:409});
 if(e.code==='23503')return Response.json({error:'This record is referenced by another document. Refresh the page and review its history.'},{status:409});
 const reference=randomUUID();console.error('ERP request failed',{reference,code:e.code,message:e.message});
 return Response.json({error:'Unable to complete this request. Please retry. If it continues, contact your administrator with reference '+reference},{status:500});
}
