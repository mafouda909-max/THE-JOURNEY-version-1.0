import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { requireAgent } from "@/lib/auth/guards";
import { formatDate } from "@/lib/format";
import { respondToContactAction } from "@/lib/contact/actions";
import { mapContactError } from "@/lib/contact/errors";
import { CONTACT_STATUS_AR, contactStatusTone } from "@/lib/contact/labels";
import { ViewMarker } from "./view-marker";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * CONTACT REQUEST DETAIL (agent side). RLS participant-read means a foreign
 * id resolves to nothing → notFound() with zero existence leakage. Opening
 * marks VIEWED idempotently; agents never close/cancel (§2.8).
 */
export default async function ContactDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ e?: string; s?: string }>;
}) {
  const { id } = await params;
  const { e: rawE, s } = await searchParams;
  const e = rawE ? mapContactError(rawE) : undefined;
  const { supabase } = await requireAgent();

  if (!UUID_RE.test(id)) notFound();

  const { data: req } = await supabase
    .from("contact_requests")
    .select(
      "id, status, message, traveler_count, travel_dates_note, response_message, created_at, viewed_at, responded_at, offer_id, traveler_id",
    )
    .eq("id", id)
    .maybeSingle();

  if (!req) notFound();

  // Traveler display name + own offer title (both readable under RLS:
  // users row via admin-free SELECT grant; offer is the agent's own row).
  const [{ data: traveler }, { data: offer }] = await Promise.all([
    supabase.from("users").select("display_name").eq("id", req.traveler_id).single(),
    supabase.from("offers").select("id, title_ar").eq("id", req.offer_id).single(),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <nav aria-label="مسار التنقل" className="mb-4 text-label-lg text-on-surface-variant">
        <Link href="/dashboard/contacts" className="hover:underline">طلبات التواصل</Link>
      </nav>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-headline-md text-on-surface">{offer?.title_ar ?? "طلب تواصل"}</h1>
        <Badge tone={contactStatusTone(req.status)}>{CONTACT_STATUS_AR[req.status] ?? req.status}</Badge>
      </div>

      {e && <p role="alert" className="mb-4 rounded-md bg-error-container px-3 py-2 text-body-sm text-on-error-container">{e}</p>}
      {s === "responded" && (
        <p role="status" className="mb-4 rounded-md bg-primary-container px-3 py-2 text-body-sm text-on-primary-container">
          تم إرسال ردك إلى المسافر.
        </p>
      )}

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant pb-3">
          <span className="text-title-md text-on-surface">
            {traveler?.display_name ?? "مسافر"}
          </span>
          <span className="text-label-md text-on-surface-variant">
            أُرسل {formatDate(req.created_at)}
            {req.viewed_at ? ` · شوهد ${formatDate(req.viewed_at)}` : ""}
            {req.responded_at ? ` · رُدّ ${formatDate(req.responded_at)}` : ""}
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-3 pt-3 text-body-sm sm:grid-cols-3">
          <div><dt className="text-on-surface-variant">عدد المسافرين</dt><dd>{req.traveler_count}</dd></div>
          <div className="col-span-2"><dt className="text-on-surface-variant">تواريخ مقترحة</dt><dd>{req.travel_dates_note ?? "مرنة"}</dd></div>
        </dl>

        <section className="mt-4">
          <h2 className="text-title-md">رسالة المسافر</h2>
          <p className="mt-1 whitespace-pre-line text-body-md text-on-surface">{req.message}</p>
        </section>
      </Card>

      {/* Response area — NEW/VIEWED only; RESPONDED shows the sent reply.
          No close/cancel affordance for agents (§2.8: traveler-only). */}
      {(req.status === "new" || req.status === "viewed") && (
        <Card className="mt-6 p-5">
          <h2 className="mb-1 text-title-md text-on-surface">الرد على الطلب</h2>
          <p className="mb-3 text-label-md text-on-surface-variant">
            ردّك واحد ومنظّم — يتضمن التفاصيل والسعر النهائي وطريقة التواصل المتفق عليها.
          </p>
          <form action={respondToContactAction} className="space-y-3">
            <input type="hidden" name="request_id" value={req.id} />
            <input type="hidden" name="back_to" value={`/dashboard/contacts/${req.id}`} />
            <textarea
              id="response_message"
              name="response_message"
              rows={5}
              required
              minLength={1}
              placeholder="اكتب ردك هنا…"
              className="w-full rounded-md border border-outline-variant bg-surface px-3 py-2 text-body-md text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            <Button type="submit" size="lg">إرسال الرد</Button>
          </form>
        </Card>
      )}
      {req.status === "responded" && (
        <Card className="mt-6 p-5">
          <h2 className="text-title-md text-on-surface">ردّك</h2>
          <p className="mt-2 whitespace-pre-line rounded-md bg-primary-container px-3 py-2 text-body-md text-on-primary-container">
            {req.response_message}
          </p>
        </Card>
      )}
      {(req.status === "closed" || req.status === "cancelled") && (
        <Card className="mt-6 p-5 text-center text-body-md text-on-surface-variant">
          {req.status === "closed"
            ? "أُغلق هذا الطلب بعد اكتمال التواصل."
            : "ألغى المسافر هذا الطلب."}
        </Card>
      )}

      {/* Idempotent open-marking (fires only while relevant; RPC no-ops otherwise) */}
      {req.status === "new" && <ViewMarker requestId={req.id} />}
    </div>
  );
}
