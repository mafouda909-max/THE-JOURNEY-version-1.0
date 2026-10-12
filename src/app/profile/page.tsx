import Link from "next/link";
import { Badge, Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireTraveler } from "@/lib/auth/guards";
import { formatDate } from "@/lib/format";
import { CONTACT_STATUS_AR, contactStatusTone } from "@/lib/contact/labels";

export const dynamic = "force-dynamic";

interface HistoryRow {
  id: string;
  status: keyof typeof CONTACT_STATUS_AR;
  message: string;
  response_message: string | null;
  created_at: string;
  responded_at: string | null;
  offer_id: string;
}

/** TRAVELER PROFILE — identity summary + contact-request history (SCREEN_MAP Zone 3). */
export default async function ProfilePage() {
  const { user, supabase } = await requireTraveler("/profile");

  const [{ data: identity }, { data: requests, error }] = await Promise.all([
    supabase.from("users").select("display_name, created_at").eq("id", user.id).single(),
    supabase
      .from("contact_requests")
      .select("id, status, message, response_message, created_at, responded_at, offer_id")
      .eq("traveler_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  // Offer titles come from the canonical public_offers projection — travelers
  // have no direct SELECT on public.offers (closed-world RLS §6), so a
  // PostgREST embed on contact_requests would silently resolve to NULL here.
  const rows = (requests ?? []) as unknown as HistoryRow[];
  const offerIds = [...new Set(rows.map((r) => r.offer_id))];
  const { data: titleRows } =
    offerIds.length > 0
      ? await supabase.from("public_offers").select("id, title_ar").in("id", offerIds)
      : { data: [] };
  const titleById = new Map(
    ((titleRows ?? []) as Array<{ id: string; title_ar: string }>).map((o) => [o.id, o.title_ar]),
  );

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 py-8 md:px-6">
      <h1 className="mb-1 text-headline-md text-on-surface">ملفي</h1>
      <p className="mb-8 text-body-sm text-on-surface-variant">
        بياناتك وطلب التواصل المرسلة إلى الوكلاء.
      </p>

      <Card className="mb-8 p-5">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex size-12 items-center justify-center rounded-full bg-primary-container text-title-md text-on-primary-container"
          >
            {(identity?.display_name ?? user.email ?? "?").slice(0, 1)}
          </span>
          <div>
            <p className="text-title-md font-semibold text-on-surface">
              {identity?.display_name ?? "مسافر"}
            </p>
            <p className="text-label-md text-on-surface-variant" dir="ltr">
              {user.email}
            </p>
            {identity?.created_at && (
              <p className="mt-0.5 text-label-md text-on-surface-variant">
                عضو منذ {formatDate(identity.created_at)}
              </p>
            )}
          </div>
        </div>
      </Card>

      <section aria-label="سجل طلبات التواصل">
        <h2 className="mb-3 text-title-lg text-on-surface">طلبات التواصل</h2>

        {error ? (
          <EmptyState
            iconName="database"
            title="تعذر تحميل السجل"
            description="حدث خطأ أثناء قراءة طلباتك. حاول التحديث."
          />
        ) : !rows || rows.length === 0 ? (
          <EmptyState
            iconName="send"
            title="لا طلبات تواصل بعد"
            description="عندما ترسل طلبًا لوكيل حول أحد العروض ستظهر حالته هنا خطوة بخطوة."
            actions={
              <Link href="/offers" className="rounded-md bg-primary px-4 py-2 text-label-lg text-on-primary hover:bg-primary/90">
                استكشف العروض
              </Link>
            }
          />
        ) : (
          <div className="space-y-3">
            {rows.map((r) => {
              const title = titleById.get(r.offer_id) ?? "عرض";
              return (
                <Card key={r.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/offers/${r.offer_id}`} className="block truncate text-title-md text-primary hover:underline">
                        {title}
                      </Link>
                      <p className="mt-0.5 line-clamp-2 text-body-sm text-on-surface-variant">{r.message}</p>
                    </div>
                    <Badge tone={contactStatusTone(r.status)}>
                      {CONTACT_STATUS_AR[r.status] ?? r.status}
                    </Badge>
                  </div>
                  <p className="mt-2 flex items-center gap-1 text-label-md text-on-surface-variant">
                    <Icon name="schedule" className="text-[14px]" />
                    أُرسل {formatDate(r.created_at)}
                    {r.responded_at ? ` · رُدّ ${formatDate(r.responded_at)}` : ""}
                  </p>
                  {r.response_message && (
                    <p className="mt-2 rounded-md bg-primary-container px-3 py-2 whitespace-pre-line text-body-sm text-on-primary-container">
                      رد الوكيل: {r.response_message}
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
