import { NextRequest, NextResponse } from "next/server";
export function proxy(request: NextRequest) {
  if (["POST", "PATCH", "PUT", "DELETE"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (
      request.headers.get("sec-fetch-site") === "cross-site" ||
      (origin && origin !== new URL(request.url).origin)
    )
      return NextResponse.json(
        { error: "Cross-origin write refused" },
        { status: 403 },
      );
    if (
      request.method !== "DELETE" &&
      !request.headers
        .get("content-type")
        ?.toLowerCase()
        .startsWith("application/json")
    )
      return NextResponse.json({ error: "JSON required" }, { status: 415 });
    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > 32768)
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }
  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Cache-Control", "no-store");
  return response;
}
export const config = { matcher: "/api/:path*" };
