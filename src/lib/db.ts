import pg from 'pg';
pg.types.setTypeParser(1082, v => v);
const g = globalThis as unknown as { rentalPool?: pg.Pool };
export const pool = g.rentalPool || new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 8, connectionTimeoutMillis: 5000 });
if (process.env.NODE_ENV !== 'production') g.rentalPool = pool;
export async function transaction<T>(fn: (db: pg.PoolClient) => Promise<T>) {
  const db = await pool.connect();
  try { await db.query('BEGIN'); const value = await fn(db); await db.query('COMMIT'); return value; }
  catch (error) { await db.query('ROLLBACK'); throw error; } finally { db.release(); }
}
