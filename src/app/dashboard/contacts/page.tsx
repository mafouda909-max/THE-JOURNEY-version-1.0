import Link from "next/link";
import { Badge, Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireAgent } from "@/lib/auth/guards";
import { formatDate } from "@/lib/format";
import { CONTACT_STATUS_AR, contactStatusTone } from "@/lib/contact/labels";

export const dynamic = "force-dynamic";

interface InboxRow {
  id: string;
  status: keyof typeof CONTACT_STATUS_AR;
  message: string;
  traveler_count: number;
  created_at: string;
  viewed_at: string | null;
  responded_at: string | null;
  offer_id: string;
  offers: { title_ar: string } | null;
}

/** CONTACTS INBOX — SCREEN_MAP Zone4: own requests only (RLS participant read). */
export default async function ContactsInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; s?: string }>;
}) {
  const { e, s } = await searchParams;
  const { supabase } = await requireAgent();

  const { data: rows, error } = await supabase
    .from("contact_requests")
    .select(
      "id, status, message, traveler_count, created_at, viewed_at, responded_at, offer_id, offers(title_ar)",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  const inbox = (rows ?? []) as unknown as InboxRow[];
  const unread = inbox.filter((r) => r.status === "new").length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 lg:px-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-headline-md text-on-surface">طلبات التواصل</h1>
        {unread > 0 && (
          <Badge tone="warning">
            {unread} جديد
          </Badge>
        )}
      </div>
      <p className="mb-6 -mt-4 text-body-sm text-on-surface-variant">
        استفسارات المسافرين حول عروضك — الرد خلال ٤٨ ساعة يحافظ على معدل استجابتك.
      </p>

      {e && <p role="alert" className="mb-4 rounded-md bg-error-container px-3 py-2 text-body-sm">{e}</p>}
      {s === "responded" && (
        <p role="status" className="mb-4 rounded-md bg-primary-container px-3 py-2 text-body-sm text-on-primary-container">
          تم إرسال ردك إلى المسافر.
        </p>
      )}

      {error ? (
        <EmptyState iconName="database" title="تعذر تحميل الصندوق" description="حدث خطأ أثناء القراءة. حاول التحديث." />
      ) : inbox.length === 0 ? (
        <EmptyState
          iconName="inbox"
          title="لا طلبات تواصل بعد"
          description="عندما يرسل مسافر طلبًا حول أحد عروضك سيظهر هنا مع إمكانية الرد المباشر."
        />
      ) : (
        <div className="space-y-3">
          {inbox.map((r) => (
            <Link key={r.id} href={`/dashboard/contacts/${r.id}`}>
              <Card hover className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-title-md text-on-surface">
                      {r.offers?.title_ar ?? "عرض"}
                    </span>
                    {r.status === "new" && <Badge tone="warning">{CONTACT_STATUS_AR.new}</Badge>}
                  </span>
                  <p className="mt-0.5 line-clamp-1 text-body-sm text-on-surface-variant">{r.message}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-label-md text-on-surface-variant">
                    {r.traveler_count} مسافر · {formatDate(r.created_at)}
                  </span>
                  {r.status !== "new" && (
                    <Badge tone={contactStatusTone(r.status)}>{CONTACT_STATUS_AR[r.status] ?? r.status}</Badge>
                  )}
                  <Icon name="chevron_left" className="text-on-surface-variant" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
