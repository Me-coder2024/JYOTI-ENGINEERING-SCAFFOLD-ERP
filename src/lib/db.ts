import pg from 'pg';
import { existsSync } from 'node:fs';
pg.types.setTypeParser(1082, v => v);
const g = globalThis as unknown as { rentalPool?: pg.Pool };

function buildPoolConfig(): pg.PoolConfig {
  const raw = process.env.DATABASE_URL || '';
  const config: pg.PoolConfig = { connectionString: raw, max: 8, connectionTimeoutMillis: 5000 };
  // When sslrootcert points to a local file that doesn't exist (e.g. Vercel production),
  // strip it from the URL and use ssl: { rejectUnauthorized: false } instead.
  try {
    const url = new URL(raw);
    const certPath = url.searchParams.get('sslrootcert');
    if (certPath && !existsSync(certPath)) {
      url.searchParams.delete('sslrootcert');
      url.searchParams.set('sslmode', 'no-verify');
      config.connectionString = url.toString();
      config.ssl = { rejectUnauthorized: false };
    }
  } catch { /* not a valid URL, let pg handle it */ }
  return config;
}

export const pool = g.rentalPool || new pg.Pool(buildPoolConfig());
if (process.env.NODE_ENV !== 'production') g.rentalPool = pool;
export async function transaction<T>(fn: (db: pg.PoolClient) => Promise<T>) {
  const db = await pool.connect();
  try { await db.query('BEGIN'); const value = await fn(db); await db.query('COMMIT'); return value; }
  catch (error) { await db.query('ROLLBACK'); throw error; } finally { db.release(); }
}
