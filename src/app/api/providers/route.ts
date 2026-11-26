import { NextResponse } from "next/server";
import { getPublicProviders } from "@/lib/data";
import { filterPublicProviders } from "@/lib/provider-directory";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const providers = await getPublicProviders();
  const filtered = filterPublicProviders(providers, {
    query: searchParams.get("q") ?? "",
    city: searchParams.get("city") ?? "",
    kind: searchParams.get("kind") ?? "",
    category: searchParams.get("category") ?? "",
  });

  return NextResponse.json(
    {
      count: filtered.length,
      providers: filtered,
    },
    { headers: NO_STORE },
  );
}
