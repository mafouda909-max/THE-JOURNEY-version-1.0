"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface MediaRow {
  id: string;
  storage_path: string;
  alt_text: string | null;
  sort_order: number;
}

/**
 * Media manager — browser uploads straight to the offer-media bucket under
 * offer-media/{offer_id}/{sort}-{name} (storage policies enforce ownership);
 * rows are tracked in public.offer_media.
 */
export function OfferMediaManager({ offerId, initial }: { offerId: string; initial: MediaRow[] }) {
  const supabase = createClient();
  const [rows, setRows] = useState<MediaRow[]>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const { data } = await supabase
      .from("offer_media")
      .select("id, storage_path, alt_text, sort_order")
      .eq("offer_id", offerId)
      .order("sort_order");
    if (data) setRows(data as MediaRow[]);
  }

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const nextSort = rows.length;
      const path = `${offerId}/${nextSort}-${file.name}`;
      const up = await supabase.storage.from("offer-media").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (up.error) throw up.error;

      const ins = await supabase
        .from("offer_media")
        .insert({ offer_id: offerId, storage_path: path, sort_order: nextSort });
      if (ins.error) throw ins.error;

      if (fileRef.current) fileRef.current.value = "";
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: MediaRow) {
    setBusy(true);
    setErr(null);
    try {
      await supabase.storage.from("offer-media").remove([row.storage_path]);
      await supabase.from("offer_media").delete().eq("id", row.id);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <h2 className="mb-3 text-title-md text-on-surface">صور العرض</h2>
      {err && <p role="alert" className="mb-3 rounded-md bg-error-container px-3 py-2 text-body-sm">{err}</p>}
      <ul className="mb-4 space-y-2" aria-label="صور العرض الحالية">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between rounded-md bg-surface-container-low px-3 py-2 text-body-sm">
            <span dir="ltr" className="truncate font-mono text-xs">{r.sort_order} · {r.storage_path}</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => remove(r)} disabled={busy}>
              حذف
            </Button>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="rounded-md bg-surface-container-low px-3 py-2 text-body-sm text-on-surface-variant">
            لا صور بعد — أضف أول صورة.
          </li>
        )}
      </ul>
      <div className="flex items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label="اختر صورة"
          className="text-body-sm"
        />
        <Button type="button" size="sm" onClick={upload} disabled={busy}>
          رفع صورة
        </Button>
      </div>
      <p className="mt-2 text-label-md text-on-surface-variant">JPEG/PNG/WEBP حتى ١٠MB.</p>
    </Card>
  );
}
