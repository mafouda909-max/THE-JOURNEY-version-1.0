import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agentDocuments } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { privateStorageProvider } from "@/lib/private-storage";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const { id } = await params;
  const agentId = Number(id);
  if (!Number.isInteger(agentId)) {
    return NextResponse.json({ error: "Invalid agent id" }, { status: 400 });
  }

  const docs = await db
    .select()
    .from(agentDocuments)
    .where(eq(agentDocuments.agentId, agentId));

  const documents = await Promise.all(
    docs.map(async (doc) => {
      const signed = await privateStorageProvider.getPresignedDownloadUrl(doc.storageKey);
      return {
        id: doc.id,
        documentType: doc.documentType,
        originalName: doc.originalName,
        status: doc.status,
        rejectionReason: doc.rejectionReason,
        expiresAt: doc.expiresAt,
        createdAt: doc.createdAt,
        signedAccessUrl: signed.downloadUrl,
        expiresInSeconds: signed.expiresInSeconds,
      };
    }),
  );

  return NextResponse.json({ documents });
}
