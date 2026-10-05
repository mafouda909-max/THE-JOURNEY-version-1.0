type Environment = Record<string, string | undefined>;

// A role/password change does not create a different physical database.
export function databaseIdentity(connectionString: string): string {
  let url: URL;
  try { url = new URL(connectionString); }
  catch { throw new Error("Invalid PostgreSQL database configuration."); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !url.pathname.slice(1)) {
    throw new Error("Invalid PostgreSQL database configuration.");
  }
  let hostname = url.hostname.toLowerCase();
  if (hostname.endsWith(".neon.tech")) hostname = hostname.replace(/-pooler(?=\.)/, "");
  let database: string;
  try { database = decodeURIComponent(url.pathname.slice(1)); }
  catch { throw new Error("Invalid PostgreSQL database configuration."); }
  return [hostname, url.port || "5432", database].join("|");
}

export function selectDatabaseUrl(environment: Environment = process.env): string {
  const ordinary = environment.DATABASE_URL ?? environment.POSTGRES_URL;
  if (environment.VERCEL_ENV === "preview") {
    const preview = environment.SILA_PREVIEW_DATABASE_URL;
    if (!preview || !ordinary) {
      throw new Error("Preview database isolation is not configured. Set a branch-scoped SILA_PREVIEW_DATABASE_URL.");
    }
    if (databaseIdentity(preview) === databaseIdentity(ordinary)) {
      throw new Error("Preview cannot use the inherited database. Configure an isolated preview database.");
    }
    return preview;
  }
  if (!ordinary) throw new Error("DATABASE_URL (or POSTGRES_URL) is required before querying the database.");
  return ordinary;
}
