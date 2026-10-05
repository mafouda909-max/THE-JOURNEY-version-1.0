import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { probeB2 } from "@/lib/b2";
import { emailProvider } from "@/lib/providers/email";
import { amadeusSupplier } from "@/lib/travel-suppliers/amadeus";
import { SITE_ORIGIN } from "@/lib/site";
import { evaluateOriginHealth } from "@/lib/origin-health";

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

  const dbStarted = Date.now();
  try {
    const dbProbe = await db.execute(sql`
      select
        current_database() as database_name,
        current_user as role_name,
        current_setting('neon.project_id', true) as neon_project_id,
        current_setting('neon.branch_id', true) as neon_branch_id
    `);
    const dbRow = (dbProbe.rows?.[0] ?? {}) as Record<string, unknown>;
    const neonProjectId = String(dbRow.neon_project_id ?? "");
    const database = {
      status: "HEALTHY" as const,
      latencyMs: Date.now() - dbStarted,
      identity: {
        database: String(dbRow.database_name ?? ""),
        role: String(dbRow.role_name ?? ""),
        neon: neonProjectId
          ? {
              legacyTarget: neonProjectId === "late-mountain-20124572",
              branchKnown: Boolean(dbRow.neon_branch_id),
            }
          : { legacyTarget: false, branchKnown: false },
      },
    };

    const [storageProbe, emailProbe, supplierProbe] = await Promise.all([
      probeB2(),
      emailProvider.probe(),
      process.env.FLIGHT_COMPARE_ENABLED === "true"
        ? amadeusSupplier.probe()
        : Promise.resolve({ connected: false, latencyMs: null as number | null, gated: true }),
    ]);

    if (storageProbe.status === "DEGRADED") {
      console.error("[health] storage provider degraded", { provider: "backblaze_b2", error: storageProbe.error });
    }
    if (emailProbe.status === "DEGRADED") {
      console.error("[health] email provider degraded", { provider: "resend", error: emailProbe.error });
    }
    if (!("gated" in supplierProbe) && !supplierProbe.connected) {
      console.error("[health] flight supplier degraded", {
        provider: "amadeus",
        error: "error" in supplierProbe ? supplierProbe.error : undefined,
      });
    }

    const storage = {
      provider: "backblaze_b2",
      status:
        storageProbe.status === "CONNECTED"
          ? "HEALTHY"
          : storageProbe.status === "NOT_CONFIGURED"
            ? "NOT_CONFIGURED"
            : "UNAVAILABLE",
      latencyMs: storageProbe.latencyMs,
    };

    const email = {
      provider: "resend",
      status:
        emailProbe.status === "CONNECTED"
          ? "HEALTHY"
          : emailProbe.status === "NOT_CONFIGURED"
            ? "NOT_CONFIGURED"
            : emailProbe.status === "CONFIGURATION_REQUIRED"
              ? "NOT_CONFIGURED"
              : "UNAVAILABLE",
      latencyMs: emailProbe.latencyMs,
    };

    const flight = "gated" in supplierProbe
      ? { provider: "amadeus", status: "GATED", latencyMs: null }
      : {
          provider: "amadeus",
          status: supplierProbe.connected ? "HEALTHY" : "UNAVAILABLE",
          latencyMs: supplierProbe.latencyMs,
        };

    const googleAuthEnabled = process.env.GOOGLE_AUTH_ENABLED === "true";
    const magicAuthEnabled = process.env.MAGIC_LINK_ENABLED === "true";
    const authEnabled = googleAuthEnabled || magicAuthEnabled;
    const origin = evaluateOriginHealth(SITE_ORIGIN, process.env.AUTH_ORIGIN);

    const criticalFailure =
      storage.status === "UNAVAILABLE" ||
      email.status === "UNAVAILABLE" ||
      flight.status === "UNAVAILABLE";

    const missingRequiredProvider =
      (magicAuthEnabled && email.status !== "HEALTHY") ||
      (process.env.FLIGHT_COMPARE_ENABLED === "true" && flight.status !== "HEALTHY") ||
      (authEnabled && origin.status !== "HEALTHY");

    const overallStatus: HealthStatus =
      criticalFailure || missingRequiredProvider || storage.status !== "HEALTHY"
        ? "DEGRADED"
        : "HEALTHY";

    return NextResponse.json(
      {
        status: overallStatus,
        ok: !criticalFailure,
        database,
        storage,
        email,
        flight,
        auth: {
          google: googleAuthEnabled,
          magic: magicAuthEnabled,
        },
        origin,
        timestamp: new Date().toISOString(),
      },
      {
        status: criticalFailure ? 503 : 200,
        headers: { "Cache-Control": "private, no-store" },
      },
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
        database: { status: "UNAVAILABLE", latencyMs: Date.now() - dbStarted },
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
