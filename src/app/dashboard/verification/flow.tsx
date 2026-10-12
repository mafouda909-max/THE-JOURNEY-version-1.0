"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/**
 * VERIFICATION FLOW — §4.3: create the in_review request, then upload
 * documents straight into the private bucket under
 * verification-documents/{agent_id}/{request_id}/{doc_type}-{filename}
 * (storage policies enforce ownership + in_review state).
 */
export function VerificationFlow({
  agentId,
  disabled,
}: {
  agentId: string;
  /** true when a request is already in_review or agent verified */
  disabled: boolean;
}) {
  const supabase = createClient();
  const [requestId, setRequestId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState(0);

  async function startRequest() {
    setBusy(true);
    setErr(null);
    try {
      const { data, error } = await supabase
        .from("verification_requests")
        .insert({ agent_id: agentId, status: "in_review" })
        .select("id")
        .single();
      if (error) {
        // Cooldown (30 days) surfaces here as a server-side rejection:
        setErr(error.message);
      } else {
        setRequestId(data.id);
      }
    } finally {
      setBusy(false);
    }
  }

  async function uploadDoc(docType: string, file: File) {
    if (!requestId) return;
    setBusy(true);
    setErr(null);
    try {
      const path = `${agentId}/${requestId}/${docType}-${file.name}`;
      const up = await supabase.storage
        .from("verification-documents")
        .upload(path, file, { upsert: false });
      if (up.error) throw up.error;

      const ins = await supabase.from("verification_documents").insert({
        request_id: requestId,
        doc_type: docType,
        storage_path: path,
        mime_type: file.type || "application/octet-stream",
        size_bytes: file.size,
      });
      if (ins.error) throw ins.error;
      setUploaded((n) => n + 1);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "upload failed");
    } finally {
      setBusy(false);
    }
  }

  if (disabled) return null;

  return (
    <Card className="p-5">
      <h2 className="mb-2 text-title-md text-on-surface">رفع مستندات التوثيق</h2>
      {!requestId ? (
        <>
          <p className="mb-3 text-body-sm text-on-surface-variant">
            ابدأ طلب توثيق جديد ثم ارفع صورة الهوية الوطنية (إلزامي) وترخيص السياحة/السجل التجاري (اختياري).
          </p>
          <Button onClick={startRequest} disabled={busy}>بدء طلب التوثيق</Button>
        </>
      ) : (
        <div className="space-y-3">
          <p role="status" className="rounded-md bg-primary-container px-3 py-2 text-body-sm text-on-primary-container">
            طلب قيد الإنشاء — ارفع المستندات ({uploaded} مرفوع).
          </p>
          {(
            [
              ["national_id", "الهوية الوطنية (إلزامي)"],
              ["tourism_license", "ترخيص سياحة (اختياري)"],
              ["commercial_registration", "سجل تجاري (اختياري)"],
            ] as const
          ).map(([type, label]) => (
            <div key={type} className="flex items-center justify-between gap-3 rounded-md bg-surface-container-low px-3 py-2">
              <span className="text-body-sm">{label}</span>
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                aria-label={label}
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadDoc(type, f);
                }}
                className="text-body-sm"
              />
            </div>
          ))}
          <p className="text-label-md text-on-surface-variant">
            PDF/JPEG/PNG حتى ١٠MB. بعد الرفع تراجع الإدارة الطلب خلال ٤٨ ساعة.
          </p>
        </div>
      )}
      {err && (
        <p role="alert" data-testid="vf-error" className="mt-3 rounded-md bg-error-container px-3 py-2 text-body-sm">
          {err}
        </p>
      )}
    </Card>
  );
}
