import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import { URL } from "url";

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
 *
 * Production hardening:
 * - TLS with certificate + hostname verification for non-local PostgreSQL hosts
 * - SSL URI parameters that can overwrite node-postgres `ssl` config are removed
 *   before passing the connection string to Pool
 * - max connections: 5 (serverless-friendly)
 * - connection timeout: 10s
 * - idle timeout: 30s
 * - TCP keepalive enabled
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

export function buildPoolConfig(connectionString: string): PoolConfig {
  const parsedUrl = new URL(connectionString);
  const isLocal =
    parsedUrl.hostname === "localhost" ||
    parsedUrl.hostname === "127.0.0.1" ||
    parsedUrl.hostname === "::1";

  if (!isLocal) {
    // node-postgres documents that SSL parameters in a connection URI replace
    // an explicitly supplied `ssl` object. Remove those URI controls so our
    // certificate-verifying TLS policy cannot be silently weakened now or by a
    // future pg/pg-connection-string semantic change.
    parsedUrl.searchParams.delete("sslmode");
    parsedUrl.searchParams.delete("sslcert");
    parsedUrl.searchParams.delete("sslkey");
    parsedUrl.searchParams.delete("sslrootcert");
  }

  const config: PoolConfig = {
    connectionString: parsedUrl.toString(),
    max: 5,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 0,
  };

  if (!isLocal) {
    // Node's default trust store validates the public CA and hostname used by
    // managed providers such as Neon. Never opt out with rejectUnauthorized=false.
    config.ssl = {
      rejectUnauthorized: true,
    };
  }

  return config;
}

function getPool(): Pool {
  if (!globalForDb.__arenaNextJsPostgresqlPool) {
    const connectionUrl = requireDatabaseUrl();
    const poolConfig = buildPoolConfig(connectionUrl);

    globalForDb.__arenaNextJsPostgresqlPool = new Pool(poolConfig);
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
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(real)
      : value;
  },
});

/** Lazy pg Pool accessor (same singleton the Drizzle client uses). */
export const pool = new Proxy({} as Pool, {
  get(_target, prop) {
    const real = getPool() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(real)
      : value;
  },
});
