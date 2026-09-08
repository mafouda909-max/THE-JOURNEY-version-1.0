import { NextResponse } from "next/server";
import { accountFromRequest } from "@/lib/identity";
import { agentKYCService, DOCUMENT_TYPES, type DocumentType } from "@/lib/kyc";
import { createScopedUploadUrl, r2Configured } from "@/lib/r2";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const a = await accountFromRequest(request);
  if (!a || a.role !== "agent" || !a.agentId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!r2Configured)
    return NextResponse.json(
      { error: "رفع الوثائق غير متاح: التخزين غير مهيأ" },
      { status: 503 },
    );
  let b: Record<string, unknown>;
  try {
    b = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (
    !b ||
    !DOCUMENT_TYPES.includes(String(b.documentType)) ||
    typeof b.filename !== "string" ||
    !b.filename.trim() ||
    b.filename.length > 200
  )
    return NextResponse.json({ error: "Invalid document" }, { status: 422 });
  try {
    if (b.action === "upload") {
      if (
        !["application/pdf", "image/jpeg", "image/png"].includes(
          String(b.contentType),
        ) ||
        typeof b.contentLength !== "number" ||
        !Number.isSafeInteger(b.contentLength) ||
        b.contentLength < 1 ||
        b.contentLength > 10 * 1024 * 1024
      )
        return NextResponse.json(
          { error: "PDF/JPEG/PNG, maximum 10 MB" },
          { status: 422 },
        );
      return NextResponse.json(
        await createScopedUploadUrl(
          `kyc/agent_${a.agentId}/${b.documentType}/`,
          b.filename,
          String(b.contentType),
          b.contentLength,
        ),
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (b.action !== "confirm" || typeof b.key !== "string")
      return NextResponse.json({ error: "Invalid action" }, { status: 422 });
    const doc = await agentKYCService.submitDocument({
      agentId: a.agentId,
      documentType: b.documentType as DocumentType,
      originalName: b.filename,
      storageKey: b.key,
      request,
    });
    return NextResponse.json(
      { id: doc.id, status: "pending" },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "تعذر التحقق من الملف أو حالته. لم يُعتمد المستند." },
      { status: 422 },
    );
  }
}
