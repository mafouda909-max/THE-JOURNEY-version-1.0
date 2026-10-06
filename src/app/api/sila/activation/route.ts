import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { resolveSilaActivationManifest } from "@/lib/sila-activation-manifest";
import { getSilaProviderHealthPassive } from "@/lib/sila-provider-health";
import { resolveSilaRuntimeStatus } from "@/lib/sila-runtime-status";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  return NextResponse.json(
    {
      manifest: resolveSilaActivationManifest(),
      runtime: resolveSilaRuntimeStatus(),
      providerHealth: getSilaProviderHealthPassive(),
    },
    { headers: NO_STORE },
  );
}
