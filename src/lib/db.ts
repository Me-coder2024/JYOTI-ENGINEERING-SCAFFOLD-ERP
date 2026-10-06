import pg from 'pg';
import { supabaseCa } from './supabase-ca';
pg.types.setTypeParser(1082, v => v);
const g = globalThis as unknown as { rentalPool?: pg.Pool };

function buildPoolConfig(): pg.PoolConfig {
  const raw = process.env.DATABASE_URL || '';
  const config: pg.PoolConfig = { connectionString: raw, max: 8, connectionTimeoutMillis: 5000 };
  // Hosted Supabase connections use a bundled public CA, never a workstation path.
  if (raw) {
    const url = new URL(raw);
    if (url.hostname.endsWith('.pooler.supabase.com') || url.hostname.endsWith('.supabase.co')) {
      for (const key of ['sslrootcert','sslmode','sslcert','sslkey']) url.searchParams.delete(key);
      config.connectionString = url.toString();
      config.ssl = { ca: process.env.SUPABASE_CA_CERT || supabaseCa, rejectUnauthorized: true };
      config.connectionTimeoutMillis = 15000;
    }
  }
  return config;
}

export const pool = g.rentalPool || new pg.Pool(buildPoolConfig());
if (process.env.NODE_ENV !== 'production') g.rentalPool = pool;
export async function transaction<T>(fn: (db: pg.PoolClient) => Promise<T>) {
  const db = await pool.connect();
  try { await db.query('BEGIN'); const value = await fn(db); await db.query('COMMIT'); return value; }
  catch (error) { await db.query('ROLLBACK'); throw error; } finally { db.release(); }
}
