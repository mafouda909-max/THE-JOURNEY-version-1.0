import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { probeB2 } from "@/lib/b2";
import { emailProvider } from "@/lib/providers/email";
import { amadeusSupplier } from "@/lib/travel-suppliers/amadeus";

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
    await db.execute(sql`select 1`);
    const database = { status: "HEALTHY" as const, latencyMs: Date.now() - dbStarted };

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
    if ("gated" in supplierProbe ? false : !supplierProbe.connected) {
      console.error("[health] flight supplier degraded", { provider: "amadeus", error: supplierProbe.error });
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

    const criticalFailure =
      storage.status === "UNAVAILABLE" ||
      email.status === "UNAVAILABLE" ||
      flight.status === "UNAVAILABLE";

    const missingRequiredProvider =
      (process.env.MAGIC_LINK_ENABLED === "true" && email.status !== "HEALTHY") ||
      (process.env.FLIGHT_COMPARE_ENABLED === "true" && flight.status !== "HEALTHY");

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
          google: process.env.GOOGLE_AUTH_ENABLED === "true",
          magic: process.env.MAGIC_LINK_ENABLED === "true",
        },
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
