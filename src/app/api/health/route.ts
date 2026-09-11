import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { b2Configured } from "@/lib/b2";

export const dynamic = "force-dynamic";

export type HealthStatus = "HEALTHY" | "DEGRADED" | "NOT_CONFIGURED" | "UNAVAILABLE";

export async function GET() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return NextResponse.json(
      {
        status: "NOT_CONFIGURED",
        ok: false,
        error: "Database is not configured",
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }

  const startTime = Date.now();
  try {
    await db.execute(sql`select 1`);
    const dbLatencyMs = Date.now() - startTime;

    const storageStatus = b2Configured ? "HEALTHY" : "NOT_CONFIGURED";
    const overallStatus: HealthStatus = storageStatus === "HEALTHY" ? "HEALTHY" : "DEGRADED";

    return NextResponse.json(
      {
        status: overallStatus,
        ok: true,
        database: { status: "HEALTHY", latencyMs: dbLatencyMs },
        storage: { provider: "backblaze_b2", status: storageStatus },
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (err: unknown) {
    console.error("[health] database probe failed", {
      name: err instanceof Error ? err.name : "UnknownError",
    });
    return NextResponse.json(
      {
        status: "UNAVAILABLE",
        ok: false,
        error: "Database health check failed",
        database: { status: "UNAVAILABLE", latencyMs: Date.now() - startTime },
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
