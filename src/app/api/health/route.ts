import { NextResponse } from "next/server";
import { capabilityRuntime } from "@/lib/capabilities/production";
import { SITE_ORIGIN } from "@/lib/site";
import { evaluateOriginHealth } from "@/lib/origin-health";
import { passwordAuthReadiness } from "@/lib/password-auth";
import type { CapabilityState } from "@/lib/capabilities/contracts";

export const dynamic = "force-dynamic";
export type HealthStatus = "HEALTHY" | "DEGRADED" | "NOT_CONFIGURED" | "UNAVAILABLE";
const NO_STORE = { "Cache-Control": "private, no-store" };
// Public release identity only; never project environment values or provider secrets.
const gitCommit = process.env.VERCEL_GIT_COMMIT_SHA;
const deployment = { commit: gitCommit && /^[0-9a-f]{40}$/i.test(gitCommit) ? gitCommit.toLowerCase() : null };
function publicState(state: CapabilityState) {
  return { provider: state.provider, status: state.ready ? "HEALTHY" : state.status === "GATED" ? "GATED" : ["NOT_CONFIGURED", "CONFIGURATION_REQUIRED", "PLANNED"].includes(state.status) ? "NOT_CONFIGURED" : "UNAVAILABLE", latencyMs: state.latencyMs };
}
export async function GET() {
  try {
    const [db, storageState, emailState, flightState, passwordReady] = await Promise.all([
      capabilityRuntime.probe("database"), capabilityRuntime.probe("storage"), capabilityRuntime.probe("email"), capabilityRuntime.probe("flights"),
      passwordAuthReadiness.probe().catch(() => false),
    ]);
    const database = publicState(db), storage = publicState(storageState), email = publicState(emailState), flight = publicState(flightState);
    const origin = evaluateOriginHealth(SITE_ORIGIN, process.env.AUTH_ORIGIN);
    const googleEnabled = process.env.GOOGLE_AUTH_ENABLED === "true";
    const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
    const magicEnabled = process.env.MAGIC_LINK_ENABLED === "true";
    const passwordEnabled = process.env.PASSWORD_AUTH_ENABLED === "true";
    // Optional mail cannot take the password pilot down. A required channel or
    // enabled supplier still fails closed when its real readiness is missing.
    const unavailable = database.status === "UNAVAILABLE" || storage.status === "UNAVAILABLE" ||
      (magicEnabled && email.status !== "HEALTHY") || (process.env.FLIGHT_COMPARE_ENABLED === "true" && flight.status !== "HEALTHY") ||
      (passwordEnabled && !passwordReady) || (googleEnabled && !googleConfigured) ||
      ((googleEnabled || magicEnabled || passwordEnabled) && origin.status !== "HEALTHY");
    const degraded = unavailable || database.status !== "HEALTHY" || storage.status !== "HEALTHY" ||
      (googleEnabled && !googleConfigured) || (passwordEnabled && !passwordReady) ||
      ((googleEnabled || magicEnabled || passwordEnabled) && origin.status !== "HEALTHY");
    const status: HealthStatus = database.status === "NOT_CONFIGURED" ? "NOT_CONFIGURED" : degraded ? "DEGRADED" : "HEALTHY";
    return NextResponse.json({ deployment, status, ok: !unavailable && database.status === "HEALTHY", database, storage, email, flight, auth: { google: googleEnabled && googleConfigured && origin.status === "HEALTHY", magic: magicEnabled && email.status === "HEALTHY" && origin.status === "HEALTHY", password: passwordEnabled && passwordReady && origin.status === "HEALTHY" }, origin, timestamp: new Date().toISOString() }, { status: unavailable || database.status !== "HEALTHY" ? 503 : 200, headers: NO_STORE });
  } catch {
    return NextResponse.json({ deployment, status: "UNAVAILABLE", ok: false, error: "HEALTH_CHECK_FAILED", timestamp: new Date().toISOString() }, { status: 503, headers: NO_STORE });
  }
}
