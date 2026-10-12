import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { requireAgent } from "@/lib/auth/guards";
import {
  archiveOfferAction,
  majorEditAction,
  minorEditAction,
  prepublicationPatchAction,
  resubmitOfferAction,
  submitOfferAction,
} from "@/lib/agent/actions";
import { OfferMediaManager } from "./media-manager";

export const dynamic = "force-dynamic";

const STATUS_AR: Record<string, string> = {
  draft: "مسودة",
  pending_review: "قيد المراجعة",
  published: "منشور",
  rejected: "مرفوض",
  expired: "منتهي",
  archived: "مؤرشف",
};

/** EDIT OFFER — status-driven forms: pre-publication patch / E1 / E2 / T4-T6. */
export default async function EditOfferPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ e?: string; s?: string; created?: string }>;
}) {
  const { id } = await params;
  const { e, s, created } = await searchParams;
  const { supabase, agentProfileId } = await requireAgent();

  const { data: offer } = await supabase
    .from("offers")
    .select("*")
    .eq("id", id)
    .eq("agent_id", agentProfileId)
    .maybeSingle();

  if (!offer) notFound();

  const { data: media } = await supabase
    .from("offer_media")
    .select("id, storage_path, alt_text, sort_order")
    .eq("offer_id", id)
    .order("sort_order");

  const prePublication = offer.status === "draft" || offer.status === "rejected" || offer.status === "expired";
  const published = offer.status === "published";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-6">
      <nav aria-label="مسار التنقل" className="mb-4 text-label-lg text-on-surface-variant">
        <Link href="/dashboard" className="hover:underline">لوحة التحكم</Link>
        {" ← "}
        <Link href="/dashboard/offers" className="hover:underline">عروضي</Link>
      </nav>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-headline-md text-on-surface">{offer.title_ar}</h1>
        <Badge tone={offer.status === "published" ? "success" : offer.status === "rejected" ? "error" : "neutral"}>
          {STATUS_AR[offer.status] ?? offer.status}
        </Badge>
      </div>

      {created && (
        <p role="status" className="mb-4 rounded-md bg-primary-container px-3 py-2 text-body-sm text-on-primary-container">
          حُفظ العرض كمسودة. أكمل الصور والتفاصيل ثم أرسله للمراجعة.
        </p>
      )}
      {s && (
        <p role="status" className="mb-4 rounded-md bg-primary-container px-3 py-2 text-body-sm text-on-primary-container">
          تم الحفظ.
        </p>
      )}
      {e && (
        <p role="alert" className="mb-4 rounded-md bg-error-container px-3 py-2 text-body-sm text-on-error-container">
          {e}
        </p>
      )}
      {offer.status === "rejected" && offer.rejection_reason && (
        <Card className="mb-4 p-4">
          <p className="text-title-md text-on-surface">سبب الرفض</p>
          <p className="mt-1 text-body-md text-on-surface-variant">{offer.rejection_reason}</p>
          <p className="mt-1 text-label-md text-on-surface-variant">عدّل العرض لمعالجة السبب ثم أعد الإرسال.</p>
        </Card>
      )}

      {/* Pre-publication content form (draft/rejected/expired) */}
      {prePublication && (
        <>
          <Card className="mb-6 p-5">
            <h2 className="mb-3 text-title-md text-on-surface">تعديل المحتوى</h2>
            <form action={prepublicationPatchAction} className="space-y-4">
              <input type="hidden" name="offer_id" value={id} />
              <Input id="title_ar" name="title_ar" label="العنوان بالعربية" defaultValue={offer.title_ar} required maxLength={200} />
              <Input id="title_en" name="title_en" label="العنوان بالإنجليزية" defaultValue={offer.title_en ?? ""} maxLength={200} />
              <Area id="description_ar" label="الوصف بالعربية" value={offer.description_ar} />
              <Area id="description_en" label="الوصف بالإنجليزية" value={offer.description_en ?? ""} />
              <Input id="price_amount" name="price_amount" label="السعر" type="number" step="0.01" min="0.01" defaultValue={Number(offer.price_amount)} required />
              <Input id="valid_until" name="valid_until" label="صالح حتى"
                type="date"
                defaultValue={offer.valid_until.slice(0, 10)}
                required
                hint={offer.status === "expired" ? "التمديد يتطلب تاريخًا أحدث من السابق" : undefined}
              />
              <Button>حفظ التعديلات</Button>
            </form>
          </Card>

          <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 p-5">
            <p className="text-body-md text-on-surface">جاهز للنشر؟ أرسل العرض إلى مراجعة الإدارة.</p>
            {offer.status === "expired" ? (
              <form action={resubmitOfferAction} className="flex items-end gap-2">
                <input type="hidden" name="offer_id" value={id} />
                <Input id="new_valid_until" name="new_valid_until" label="صلاحية جديدة حتى" type="date" required />
                <Button type="submit">تجديد وإعادة إرسال</Button>
              </form>
            ) : (
              <form action={submitOfferAction}>
                <input type="hidden" name="offer_id" value={id} />
                {/* T1 applies to drafts; T4 resubmission lives in the expired branch above
                    and in the rejected flow via prepublication patch + resubmit below. */}
                <Button type="submit">إرسال للمراجعة</Button>
              </form>
            )}
          </Card>

          {offer.status === "rejected" && (
            <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 p-5">
              <p className="text-body-md text-on-surface">
                بعد معالجة سبب الرفض أعلاه، أعد الإرسال مع تمديد الصلاحية إن لزم.
              </p>
              <form action={resubmitOfferAction} className="flex items-end gap-2">
                <input type="hidden" name="offer_id" value={id} />
                <Input id="resub_valid_until" name="new_valid_until" label="صلاحية حتى" type="date"
                  defaultValue={offer.valid_until.slice(0, 10)} required />
                <Button type="submit">إعادة إرسال للمراجعة</Button>
              </form>
            </Card>
          )}

          <ArchiveBox id={id} />
        </>
      )}

      {/* Published: E1 minor + E2 major + media */}
      {published && (
        <>
          <OfferMediaManager offerId={id} initial={media ?? []} />

          <Card className="my-6 p-5">
            <h2 className="mb-1 text-title-md text-on-surface">تعديل بسيط (بدون إعادة مراجعة)</h2>
            <p className="mb-3 text-label-md text-on-surface-variant">
              يشمل: الوصف، يشمل/لا يشمل. تعديل السعر أو المسار أو التواريخ يتطلب مراجعة جديدة.
            </p>
            <form action={minorEditAction} className="space-y-4">
              <input type="hidden" name="offer_id" value={id} />
              <Area id="description_ar" label="الوصف بالعربية" value={offer.description_ar} />
              <Area id="description_en" label="الوصف بالإنجليزية" value={offer.description_en ?? ""} />
              <Area id="includes" label="يشمل" value={offer.includes.join("\n")} />
              <Area id="excludes" label="لا يشمل" value={offer.excludes.join("\n")} />
              <Button variant="secondary">حفظ التعديل البسيط</Button>
            </form>
          </Card>

          <Card className="mb-6 p-5">
            <h2 className="mb-1 text-title-md text-on-surface">تعديل جوهري (يتطلب إعادة مراجعة)</h2>
            <p className="mb-3 text-label-md text-on-surface-variant">
              السعر/المسار/التواريخ/الصلاحية — يُحوَّل العرض فورًا إلى «قيد المراجعة» مع تسجيل التغييرات للإدارة.
            </p>
            <form action={majorEditAction} className="space-y-4">
              <input type="hidden" name="offer_id" value={id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input id="price_amount" name="price_amount" label="سعر جديد (اختياري)" type="number" step="0.01" min="0.01" />
                <Input id="currency" name="currency" label="عملة جديدة (اختياري)" maxLength={3} />
                <Input id="valid_until" name="valid_until" label="صلاحية جديدة حتى (اختياري)" type="date" />
              </div>
              <Button variant="secondary">إرسال التعديل الجوهري للمراجعة</Button>
            </form>
          </Card>

          <ArchiveBox id={id} />
        </>
      )}

      {(offer.status === "pending_review" || offer.status === "archived") && (
        <Card className="p-8 text-center text-body-md text-on-surface-variant">
          {offer.status === "pending_review"
            ? "هذا العرض قيد مراجعة الإدارة حاليًا ولا يمكن تعديله."
            : "هذا العرض مؤرشف (حالة نهائية)."}
        </Card>
      )}
    </div>
  );
}

function ArchiveBox({ id }: { id: string }) {
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 border-error/30 p-5">
      <p className="text-body-sm text-on-surface-variant">
        الأرشفة نهائية ويُخفي العرض عن الجميع.
      </p>
      <form action={archiveOfferAction}>
        <input type="hidden" name="offer_id" value={id} />
        <Button type="submit" variant="ghost">أرشفة العرض</Button>
      </form>
    </Card>
  );
}

function Area({ id, label, value }: { id: string; label: string; value: string }) {
  return (
    <div className="w-full">
      <label htmlFor={id} className="mb-1.5 block text-label-lg text-on-surface-variant">{label}</label>
      <textarea
        id={id}
        name={id}
        rows={3}
        defaultValue={value}
        className="w-full rounded-md border border-outline-variant bg-surface px-3 py-2 text-body-md text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      />
    </div>
  );
}
