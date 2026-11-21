// Database access. Uses real Postgres when DATABASE_URL is set (Railway),
// otherwise an embedded Postgres (PGlite) stored on disk, for local dev and tests.
import path from "node:path";
import { config } from "./config.js";

type Row = Record<string, any>;
type QueryFn = (sql: string, params?: unknown[]) => Promise<Row[]>;

let queryImpl: QueryFn | null = null;

async function init(): Promise<QueryFn> {
  if (config.databaseUrl) {
    const pg = await import("pg");
    const pool = new pg.default.Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseUrl.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
    });
    return async (sql, params = []) => (await pool.query(sql, params as any[])).rows;
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite(path.join(config.dataDir, "pglite"));
  return async (sql, params = []) => (await db.query<Row>(sql, params as any[])).rows;
}

export async function query<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  if (!queryImpl) queryImpl = await init();
  return (await queryImpl(sql, params)) as T[];
}

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS settings (
     business_id TEXT NOT NULL DEFAULT 'default',
     key TEXT NOT NULL,
     value JSONB NOT NULL,
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     PRIMARY KEY (business_id, key)
   )`,
  `CREATE TABLE IF NOT EXISTS posts (
     id TEXT PRIMARY KEY,
     business_id TEXT NOT NULL DEFAULT 'default',
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     source TEXT NOT NULL DEFAULT 'manual',
     status TEXT NOT NULL,
     brief JSONB NOT NULL,
     content JSONB,
     media JSONB NOT NULL DEFAULT '[]'::jsonb,
     check_report JSONB,
     platforms JSONB NOT NULL DEFAULT '[]'::jsonb,
     publish_at TIMESTAMPTZ,
     results JSONB NOT NULL DEFAULT '{}'::jsonb,
     error TEXT
   )`,
  `CREATE INDEX IF NOT EXISTS posts_business_created ON posts (business_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS posts_due ON posts (status, publish_at)`,
  `CREATE TABLE IF NOT EXISTS llm_jobs (
     id TEXT PRIMARY KEY,
     status TEXT NOT NULL,
     payload JSONB NOT NULL,
     result JSONB,
     error TEXT,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     claimed_at TIMESTAMPTZ
   )`,
];

export async function migrate() {
  for (const sql of MIGRATIONS) await query(sql);
}
