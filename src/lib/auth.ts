import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
const secret = () => { const value = process.env.SESSION_SECRET; if (!value || value.length < 32) throw new Error('Set SESSION_SECRET with at least 32 characters.'); return value; };
export function validPassword(value: string) {
  const expected = process.env.OFFICE_PASSWORD;
  if (!expected) return false;
  const a = Buffer.from(value), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function createSession() { const data = `${Date.now() + 12 * 3600000}.${randomBytes(16).toString('hex')}`; return `${data}.${createHmac('sha256', secret()).update(data).digest('hex')}`; }
export async function authenticated() {
  const value = (await cookies()).get('jyoti_session')?.value;
  if (!value) return false;
  const [expiry, nonce, sig] = value.split('.');
  if (!expiry || !nonce || !sig || Number(expiry) < Date.now()) return false;
  const expected = createHmac('sha256', secret()).update(`${expiry}.${nonce}`).digest('hex');
  return sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}
