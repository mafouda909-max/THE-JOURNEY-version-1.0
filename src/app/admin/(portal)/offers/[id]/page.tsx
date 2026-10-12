import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card } from "@/components/ui/Card";
import { requireAdminMfa } from "@/lib/auth/guards";
import { formatDate, formatPrice } from "@/lib/format";
import { approveOfferAction, rejectOfferAction } from "@/lib/admin/actions";

export const dynamic = "force-dynamic";

/** OFFER REVIEW DETAIL — full preview + approve / reject-with-reason (T2/T3). */
export default async function AdminOfferReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ e?: string }>;
}) {
  const { id } = await params;
  const { e } = await searchParams;
  const { supabase } = await requireAdminMfa();

  const { data: offer } = await supabase
    .from("offers")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!offer) notFound();

  const { data: media } = await supabase
    .from("offer_media")
    .select("id, storage_path")
    .eq("offer_id", id);

  return (
    <div className="mx-auto max-w-3xl">
      <nav aria-label="مسار التنقل" className="mb-4 text-label-lg text-on-surface-variant">
        <Link href="/admin/offers" className="hover:underline">قائمة المراجعة</Link>
      </nav>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-headline-md text-on-surface">{offer.title_ar}</h1>
        <Badge tone="warning">{offer.status}</Badge>
      </div>

      {e && <p role="alert" className="mb-4 rounded-md bg-error-container px-3 py-2 text-body-sm">{e}</p>}

      <Card className="p-6">
        <p className="text-body-lg text-on-surface">{offer.origin_city_id && "…"} {offer.destination_city_id && ""}</p>
        <p className="mt-1 text-body-sm text-on-surface-variant">
          {formatPrice(offer.price_amount, offer.currency)} · {offer.price_type} · {offer.price_basis}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-outline-variant pt-4 text-body-sm sm:grid-cols-3">
          <div><dt className="text-on-surface-variant">صالح من</dt><dd>{formatDate(offer.valid_from)}</dd></div>
          <div><dt className="text-on-surface-variant">صالح حتى</dt><dd>{formatDate(offer.valid_until)}</dd></div>
          <div><dt className="text-on-surface-variant">المدة</dt><dd>{offer.duration_days ?? "مرن"}</dd></div>
        </dl>
        <section className="mt-4">
          <h2 className="text-title-md">الوصف</h2>
          <p className="whitespace-pre-line text-body-md">{offer.description_ar}</p>
        </section>
        {media && media.length > 0 && (
          <section className="mt-4">
            <h2 className="text-title-md">الوسائط ({media.length})</h2>
            <ul className="mt-1 space-y-1 font-mono text-xs" dir="ltr">
              {media.map((m) => (<li key={m.id}>{m.storage_path}</li>))}
            </ul>
          </section>
        )}
      </Card>

      {/* T2/T3 decisions */}
      <Card className="mt-6 p-5">
        <form action={approveOfferAction} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="offer_id" value={id} />
          <button type="submit"
            className="rounded-full bg-primary px-5 py-2.5 text-label-lg text-on-primary">
            اعتماد ونشر
          </button>
        </form>

        <details className="mt-4 rounded-md bg-error-container/40 p-3">
          <summary className="cursor-pointer text-label-lg text-error">رفض العرض (يتطلب سببًا)</summary>
          <form action={rejectOfferAction} className="mt-3 space-y-3">
            <input type="hidden" name="offer_id" value={id} />
            <textarea name="reason" rows={3} required minLength={5}
              placeholder="سبب الرفض — يُرسل إلى الوكيل"
              className="w-full rounded-md border border-outline-variant bg-surface px-3 py-2 text-body-md" />
            <button type="submit"
              className="rounded-full border border-error px-4 py-2 text-label-lg text-error">
              رفض العرض
            </button>
          </form>
        </details>
      </Card>
    </div>
  );
}
