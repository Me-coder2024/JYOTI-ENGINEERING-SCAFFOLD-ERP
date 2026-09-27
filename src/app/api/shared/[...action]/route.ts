import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { login, logout, saveUser } from '@/shared/auth-server';
import { requireApi, sameOrigin, errorResponse } from '@/shared/guards';
import { createSession } from '@/lib/auth';
import { homeFor } from '@/shared/access';
import { pool } from '@/lib/db';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(req:NextRequest,{params}:{params:Promise<{action:string[]}>}) {
 try {
  sameOrigin(req);const path=(await params).action[0];
  if(path==='logout') {await logout(req.cookies.get('erp_session')?.value);const jar=await cookies();jar.delete('erp_session');jar.delete('jyoti_session');return NextResponse.json({ok:true});}
  if(path==='login') {
   const result=await login(await req.json()),jar=await cookies(),options={httpOnly:true,sameSite:'strict' as const,secure:process.env.APP_ORIGIN?.startsWith('https://')||req.nextUrl.protocol==='https:',maxAge:43200,path:'/'};
   jar.set('erp_session',result.token,options);
   // Bridge to the frozen rental authentication; shared role checks still gate every request.
   if(result.user.role!=='MANUFACTURING_STAFF')jar.set('jyoti_session',createSession(),options);else jar.delete('jyoti_session');
   return NextResponse.json({redirect:homeFor(result.user.role)});
  }
  if(path==='users')return NextResponse.json(await saveUser(await requireApi(req,'owner'),await req.json()));
  return NextResponse.json({error:'Not found.'},{status:404});
 }catch(e){return errorResponse(e);}
}
export async function GET(req:NextRequest) {try{await requireApi(req,'owner');return NextResponse.json((await pool.query('SELECT id,name,login,role,is_active,created_at FROM erp_users ORDER BY created_at')).rows);}catch(e){return errorResponse(e);}}
