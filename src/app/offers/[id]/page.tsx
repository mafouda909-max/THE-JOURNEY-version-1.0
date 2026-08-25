import Link from "next/link";
import type { Metadata } from "next";
import { Badge, Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { formatDate, formatPrice, isExpiringSoon } from "@/lib/format";
import { ContactCtaSoon } from "@/components/offers/ContactCtaSoon";
import { getPublicOfferServer } from "@/lib/data/agents";
import {
  DataSourceUnavailableError,
  type PublicOfferRow,
} from "@/lib/data/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!UUID_RE.test(id)) return { title: "عرض غير موجود | الرحلة" };
  try {
    const offer = await getPublicOfferServer(id);
    if (!offer) return { title: "عرض غير متاح | الرحلة" };
    return {
      title: `${offer.title_ar} | الرحلة`,
      description: offer.description_ar.slice(0, 160),
    };
  } catch {
    return { title: "الرحلة" };
  }
}

export default async function OfferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let offer: PublicOfferRow | null = null;
  let unavailable = false;
  if (UUID_RE.test(id)) {
    try {
      offer = await getPublicOfferServer(id);
    } catch (e) {
      unavailable = e instanceof DataSourceUnavailableError;
    }
  }

  return (
    <div className="mx-auto min-h-dvh max-w-7xl px-4 py-6 md:px-6 lg:px-10">
      {/* Breadcrumb — UX_AUDIT missing-item fix */}
      <nav aria-label="مسار التنقل" className="mb-4 text-label-lg text-on-surface-variant">
        <ol className="flex items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-primary hover:underline">
              الرئيسية
            </Link>
          </li>
          <Icon name="chevron_left" className="text-[16px]" />
          <li>
            <Link href="/offers" className="hover:text-primary hover:underline">
              العروض
            </Link>
          </li>
        </ol>
      </nav>

      {!offer ? (
        unavailable ? (
          <EmptyState
            iconName="database"
            title="خدمة البيانات غير مهيأة بعد"
            description="لم يتم ربط قاعدة البيانات في هذه البيئة بعد."
            actions={
              <ButtonLink href="/offers" variant="secondary" size="sm">
                رجوع إلى العروض
              </ButtonLink>
            }
          />
        ) : (
          <EmptyState
            iconName="search_off"
            title="هذا العرض غير متاح"
            description="قد يكون العرض منتهيًا أو لم يعد منشورًا."
            actions={
              <ButtonLink href="/offers" size="sm">
                استكشف عروضًا أخرى
              </ButtonLink>
            }
          />
        )
      ) : (
        <DetailView offer={offer} />
      )}
    </div>
  );
}

function DetailView({ offer }: { offer: PublicOfferRow }) {
  const expiring = isExpiringSoon(offer.valid_until);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* Main column */}
      <div className="space-y-6">
        <Card className="p-5 md:p-6">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge tone="brand">{offer.trip_type}</Badge>
            {expiring && (
              <Badge tone="warning" icon="schedule">
                ينتهي قريبًا
              </Badge>
            )}
          </div>

          <h1 className="text-headline-lg text-on-surface">{offer.title_ar}</h1>
          <p className="mt-2 flex items-center gap-2 text-body-lg text-on-surface-variant">
            <span>{offer.origin_city_ar}</span>
            <Icon name="arrow_back" />
            <span className="font-semibold text-on-surface">{offer.destination_city_ar}</span>
            {(offer.origin_airport_iata || offer.destination_airport_iata) && (
              <bdi className="text-label-md tracking-wider">
                (<span dir="ltr">{[offer.origin_airport_iata, offer.destination_airport_iata].filter(Boolean).join(" → ")}</span>)
              </bdi>
            )}
          </p>

          <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-outline-variant pt-5 sm:grid-cols-3">
            <Fact label="التواريخ" value={dateRange(offer)} />
            <Fact label="المدة" value={offer.duration_days ? `${offer.duration_days} أيام` : "مرنة"} />
            <Fact
              label="المسار"
              value={offer.route_type === "transit" ? "بمحطة تحويل" : offer.route_type === "direct" ? "مباشر" : "—"}
            />
            <Fact label="الناقل" value={offer.airline_name_ar ?? "—"} />
            <Fact label="المسافرون" value={`${offer.min_travelers}${offer.max_travelers ? `–${offer.max_travelers}` : "+"}`} />
            <Fact label="صالح حتى" value={formatDate(offer.valid_until)} />
          </dl>

          <section className="mt-6">
            <h2 className="mb-2 text-title-md">تفاصيل العرض</h2>
            <p className="whitespace-pre-line text-body-md leading-relaxed text-on-surface">
              {offer.description_ar}
            </p>
          </section>

          {(offer.includes.length > 0 || offer.excludes.length > 0) && (
            <section className="mt-6 grid gap-4 sm:grid-cols-2">
              <IncludesList title="يشمل" items={offer.includes} icon="check_circle" tone="success" />
              <IncludesList title="لا يشمل" items={offer.excludes} icon="cancel" tone="error" />
            </section>
          )}
        </Card>
      </div>

      {/* Side column: price + agent + CTA */}
      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <Card className="p-5">
          <p className="tabular-nums text-headline-lg font-bold text-primary">
            <bdi>{formatPrice(offer.price_amount, offer.currency)}</bdi>
          </p>
          <p className="mt-1 text-label-md text-on-surface-variant">
            {offer.price_type === "starting_from" && "يبدأ من · "}
            {offer.price_basis === "per_person" ? "للشخص" : offer.price_basis === "per_group" ? "للمجموعة" : "إجمالي"}
          </p>
          <p className="mt-3 rounded-sm bg-info-container px-3 py-2 text-label-md text-on-info-container">
            السعر النهائي يؤكد مباشرة مع الوكيل وفق سياسة الأسعار.
          </p>
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 text-title-md">مقدم العرض</h2>
          <Link
            href={`/agents/${offer.agent_id}`}
            className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span aria-hidden className="flex size-12 items-center justify-center rounded-full bg-primary-container text-title-md text-on-primary-container">
              {offer.agent_display_name.slice(0, 1)}
            </span>
            <span>
              <span className="block text-title-md font-semibold text-on-surface">
                {offer.agent_display_name}
              </span>
              <span className="flex items-center gap-1 text-label-md text-success">
                <Icon name="verified" filled className="text-[16px]" />
                وكيل موثّق
              </span>
            </span>
          </Link>

          {/* Ratified (b): CTA visual now; contact flow lands in Slice 3. */}
          <ContactCtaSoon />
        </Card>
      </aside>
    </div>
  );
}

function dateRange(o: PublicOfferRow): string {
  if (o.flexible_dates || (!o.departure_date && !o.return_date)) return "مرونة كاملة";
  const dep = o.departure_date ? formatDate(o.departure_date) : "";
  const ret = o.return_date ? formatDate(o.return_date) : "";
  return [dep, ret].filter(Boolean).join(" ← ");
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-label-md text-on-surface-variant">{label}</dt>
      <dd className="mt-0.5 text-body-md text-on-surface">{value}</dd>
    </div>
  );
}

function IncludesList({
  title,
  items,
  icon,
  tone,
}: {
  title: string;
  items: string[];
  icon: string;
  tone: "success" | "error";
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 text-title-md">{title}</h3>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it} className="flex items-center gap-2 text-body-md text-on-surface">
            <Icon
              name={icon}
              filled
              className={tone === "success" ? "text-[18px] text-success" : "text-[18px] text-error"}
            />
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
