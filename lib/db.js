// Postgres access layer. Works against local Postgres (tests) and Neon (prod).
// Uses node-postgres (pg). Neon requires SSL; localhost does not.
import pg from 'pg';
const { Pool } = pg;

let _pool = null;
export function dbConfigured(){ return !!process.env.DATABASE_URL; }
export function pool(){
  if(_pool) return _pool;
  const url = process.env.DATABASE_URL;
  if(!url) throw new Error('DATABASE_URL not set');
  const local = /@(localhost|127\.0\.0\.1|host\.docker\.internal)/.test(url);
  _pool = new Pool({
    connectionString: url,
    max: 2, idleTimeoutMillis: 10000, connectionTimeoutMillis: 8000,
    ssl: local ? false : { rejectUnauthorized: false },
  });
  return _pool;
}
export async function q(text, params){ return (await pool().query(text, params)).rows; }
export async function one(text, params){ return (await q(text, params))[0] || null; }
