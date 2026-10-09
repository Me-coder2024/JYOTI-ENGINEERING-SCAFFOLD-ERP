import {NextRequest} from 'next/server';
import {requireApi,sameOrigin,errorResponse} from '@/shared/guards';
import {AccessError} from '@/shared/access';
import {validGstin} from '@/rental/gst';
import {gstChallenge,lookupPortal} from '@/rental/gst-live';
import {pool} from '@/lib/db';
import {z} from 'zod';
export const runtime='nodejs';
export const maxDuration=45;
const gst=z.string().trim().toUpperCase().refine(validGstin,'Enter a valid GSTIN.');
async function limit(user:string){if(process.env.GST_LOOKUP_DISABLED==='1')throw new AccessError('GST lookup is disabled on this server.',503);const r=await pool.query("INSERT INTO erp_login_attempts(key,attempts,expires_at) VALUES($1,1,now()+interval '15 minutes') ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN erp_login_attempts.expires_at<now() THEN 1 ELSE erp_login_attempts.attempts+1 END,expires_at=CASE WHEN erp_login_attempts.expires_at<now() THEN now()+interval '15 minutes' ELSE erp_login_attempts.expires_at END RETURNING attempts",['gst-lookup:'+user]);if(r.rows[0].attempts>30)throw new AccessError('Too many GST requests. Please wait 15 minutes.',429);}
export async function GET(req:NextRequest){try{const user=await requireApi(req,'rental');const gstin=gst.parse(req.nextUrl.searchParams.get('gstin'));await limit(user.id);return Response.json(await gstChallenge(user.id,gstin),{headers:{'Cache-Control':'private, no-store'}});}catch(e){return errorResponse(e);}}
export async function POST(req:NextRequest){try{sameOrigin(req);const user=await requireApi(req,'rental');const d=z.object({gstin:gst,token:z.string().min(20).max(20000),captcha:z.string().trim().regex(/^[a-zA-Z0-9]{4,10}$/,'Enter the CAPTCHA characters shown.')}).parse(await req.json());await limit(user.id);return Response.json(await lookupPortal(user.id,d.gstin,d.token,d.captcha),{headers:{'Cache-Control':'private, no-store'}});}catch(e){return errorResponse(e);}}
