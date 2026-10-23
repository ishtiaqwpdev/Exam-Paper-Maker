/* Database connection + schema (Postgres — e.g. Neon, added from Vercel → Storage).
   Vercel sets DATABASE_URL (or POSTGRES_URL) automatically when the database is connected to the project.
   Tables are created automatically on first use. */
let pool = null, ready = null, override = null;

function url() { return process.env.DATABASE_URL || process.env.POSTGRES_URL || ''; }
function configured() { return !!(override || url()); }

function getPool() {
  if (override) return override;                 // tests inject a database here
  if (!pool) {
    const { Pool } = require('pg');
    pool = new Pool({ connectionString: url(), max: 3, idleTimeoutMillis: 10000, ssl: /localhost|127\.0\.0\.1/.test(url()) ? false : { rejectUnauthorized: false } });
  }
  return pool;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS pm_users (
     id TEXT PRIMARY KEY,
     email TEXT NOT NULL UNIQUE,
     name TEXT NOT NULL,
     academy TEXT NOT NULL DEFAULT '',
     role TEXT NOT NULL DEFAULT 'teacher',
     pass_hash TEXT NOT NULL,
     token_version INTEGER NOT NULL DEFAULT 0,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS pm_papers (
     id TEXT PRIMARY KEY,
     owner_id TEXT NOT NULL REFERENCES pm_users(id) ON DELETE CASCADE,
     data JSONB NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS pm_papers_owner ON pm_papers(owner_id)`
];

async function query(text, params) {
  const p = getPool();
  if (!ready) ready = (async () => { for (const s of SCHEMA) await p.query(s); })().catch(e => { ready = null; throw e; });
  await ready;
  const r = await p.query(text, params || []);
  return r.rows;
}

module.exports = { query, configured, _setTestDb(db) { override = db; ready = null; } };
