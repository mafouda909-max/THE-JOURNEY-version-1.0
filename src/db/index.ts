import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/**
 * THE JOURNEY — database client.
 *
 * Initialization is LAZY: importing this module no longer creates a pool or
 * throws. A missing database configuration only fails when a query is actually
 * attempted, so `next build` can compile every route (including static
 * infrastructure like /sitemap.xml) without a live database, while runtime
 * routes still fail loudly and clearly if configuration is absent.
 *
 * The pool is a global singleton (survives HMR in dev; one pool per serverless
 * instance in production — the behavior Vercel recommends for node-postgres).
 */

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __arenaNextJsPostgresqlDb?: NodePgDatabase;
};

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL (or POSTGRES_URL) is required — set it in the environment before querying the database.",
    );
  }
  return url;
}

function getPool(): Pool {
  if (!globalForDb.__arenaNextJsPostgresqlPool) {
    globalForDb.__arenaNextJsPostgresqlPool = new Pool({
      connectionString: requireDatabaseUrl(),
    });
  }
  return globalForDb.__arenaNextJsPostgresqlPool;
}

function getDb(): NodePgDatabase {
  if (!globalForDb.__arenaNextJsPostgresqlDb) {
    globalForDb.__arenaNextJsPostgresqlDb = drizzle(getPool());
  }
  return globalForDb.__arenaNextJsPostgresqlDb;
}

/** Lazy Drizzle client — proxies to the real instance on first property access. */
export const db = new Proxy({} as NodePgDatabase, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(real) : value;
  },
});

/** Lazy pg Pool accessor (same singleton the Drizzle client uses). */
export const pool = new Proxy({} as Pool, {
  get(_target, prop) {
    const real = getPool() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(real) : value;
  },
});
