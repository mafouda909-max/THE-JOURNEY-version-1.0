/**
 * SEED SAFETY POLICY — policy §9.
 *
 * THE JOURNEY's demo seed script performs destructive, full-table DELETEs on
 * every marketplace table before inserting fabricated data. This module is the
 * single, pure, testable guard that gates that behaviour so it can never be
 * run against production by accident.
 *
 * Rules:
 *   - NODE_ENV === "production"            -> hard-block (never overridable).
 *   - Non-local (remote/hosted) DATABASE_URL -> require an explicit
 *     `ALLOW_DESTRUCTIVE_SEED=1` opt-in. This covers staging/test hosts so a
 *     stray `npm run seed` cannot silently wipe a shared environment.
 *   - Local (localhost / 127.0.0.1 / ::1) dev DB -> permitted for iteration.
 */

export class SeedDestructionBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeedDestructionBlockedError";
  }
}

export function isLocalDatabaseUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    // Node's WHATWG URL returns IPv6 literals with brackets (e.g. "[::1]"),
    // so strip them before comparing.
    const host = new URL(url).hostname.replace(/^\[|\]$/g, "");
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

export function assertSeedCanDestructure(opts: {
  nodeEnv?: string;
  databaseUrl?: string;
  allowDestructiveSeed?: string;
}): void {
  if (opts.nodeEnv === "production") {
    throw new SeedDestructionBlockedError(
      "SEED BLOCKED: refusing to run the destructive demo seed against a production environment. " +
        "Production must stay empty-but-functional; add real reference data only.",
    );
  }
  if (
    !isLocalDatabaseUrl(opts.databaseUrl) &&
    opts.allowDestructiveSeed !== "1"
  ) {
    throw new SeedDestructionBlockedError(
      "SEED BLOCKED: the target DATABASE_URL is not a local development database. " +
        "To run the destructive demo seed on a staging/test host, re-run with ALLOW_DESTRUCTIVE_SEED=1. " +
        "This is never permitted against production.",
    );
  }
}
