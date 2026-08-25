import Link from "next/link";
import type { Metadata } from "next";
import { Badge, Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { OfferCard } from "@/components/offers/OfferCard";
import {
  DataSourceUnavailableError,
  type PublicAgentProfileRow,
} from "@/lib/data/types";
import { getPublicAgentServer, listAgentPublicOffersServer } from "@/lib/data/agents";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!UUID_RE.test(id)) return { title: "وكيل غير موجود | الرحلة" };
  try {
    const agent = await getPublicAgentServer(id);
    if (!agent) return { title: "وكيل غير متاح | الرحلة" };
    return { title: `${agent.display_name} | الرحلة`, description: agent.bio_ar ?? undefined };
  } catch {
    return { title: "الرحلة" };
  }
}

export default async function AgentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let agent: PublicAgentProfileRow | null = null;
  let offers: Awaited<ReturnType<typeof listAgentPublicOffersServer>> = [];
  let unavailable = false;

  if (UUID_RE.test(id)) {
    try {
      agent = await getPublicAgentServer(id);
      if (agent) offers = await listAgentPublicOffersServer(id);
    } catch (e) {
      unavailable = e instanceof DataSourceUnavailableError;
    }
  }

  return (
    <div className="mx-auto min-h-dvh max-w-7xl px-4 py-6 md:px-6 lg:px-10">
      <nav aria-label="مسار التنقل" className="mb-4 text-label-lg text-on-surface-variant">
        <ol className="flex items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-primary hover:underline">
              الرئيسية
            </Link>
          </li>
          <Icon name="chevron_left" className="text-[16px]" />
        </ol>
      </nav>

      {!agent ? (
        unavailable ? (
          <EmptyState
            iconName="database"
            title="خدمة البيانات غير مهيأة بعد"
            actions={
              <ButtonLink href="/" variant="secondary" size="sm">
                الرئيسية
              </ButtonLink>
            }
          />
        ) : (
          <EmptyState
            iconName="person_off"
            title="هذا الوكيل غير متاح"
            description="قد يكون الملف غير موثّق أو موقوفًا حاليًا."
            actions={
              <ButtonLink href="/offers" size="sm">
                استكشف العروض
              </ButtonLink>
            }
          />
        )
      ) : (
        <AgentView agent={agent} offers={offers} />
      )}
    </div>
  );
}

function AgentView({
  agent,
  offers,
}: {
  agent: PublicAgentProfileRow;
  offers: Awaited<ReturnType<typeof listAgentPublicOffersServer>>;
}) {
  return (
    <div className="space-y-6">
      {/* Header card — trust-first hierarchy */}
      <Card className="p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-4">
          <span
            aria-hidden
            className="flex size-20 items-center justify-center rounded-full bg-primary-container text-display-md text-on-primary-container"
          >
            {agent.display_name.slice(0, 1)}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-headline-lg text-on-surface">{agent.display_name}</h1>
            {agent.business_name && (
              <p className="mt-0.5 text-body-md text-on-surface-variant">{agent.business_name}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone="success" icon="verified">
                وكيل موثّق
              </Badge>
              {agent.city_name_ar && <Badge tone="neutral" icon="location_on">{agent.city_name_ar}</Badge>}
              {agent.avg_rating !== null && agent.avg_rating > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-surface-container px-3 py-1 text-label-lg text-on-surface">
                  <Icon name="star" filled className="text-[16px] text-tertiary" />
                  <bdi dir="ltr">{Number(agent.avg_rating).toFixed(1)}</bdi>
                  <span className="text-on-surface-variant">({agent.reviews_count})</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-outline-variant pt-5 sm:grid-cols-4">
          <Stat label="عروض نشطة" value={String(agent.published_offers_count)} />
          <Stat label="التقييم" value={agent.avg_rating ? Number(agent.avg_rating).toFixed(1) : "—"} />
          <Stat label="مراجعات" value={String(agent.reviews_count)} />
          <Stat label="عضو منذ" value={new Date(agent.joined_at).getUTCFullYear().toString()} />
        </dl>

        {agent.bio_ar && (
          <section className="mt-5 border-t border-outline-variant pt-5">
            <h2 className="mb-2 text-title-md">نبذة</h2>
            <p className="whitespace-pre-line text-body-md leading-relaxed text-on-surface">
              {agent.bio_ar}
            </p>
          </section>
        )}

        {agent.specialty_tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {agent.specialty_tags.map((t) => (
              <Badge key={t} tone="brand">
                {t}
              </Badge>
            ))}
          </div>
        )}
      </Card>

      {/* Offers */}
      <section aria-label="عروض الوكيل">
        <h2 className="mb-4 text-headline-md text-on-surface">العروض الحالية</h2>
        {offers.length === 0 ? (
          <EmptyState
            iconName="local_offer"
            title="لا توجد عروض نشطة حاليًا"
            description="تابع هذه الصفحة لعروض الوكيل القادمة."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {offers.map((o) => (
              <OfferCard key={o.id} offer={o} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm bg-surface-container-low px-3 py-2.5">
      <dt className="text-label-md text-on-surface-variant">{label}</dt>
      <dd className="tabular-nums text-title-md text-on-surface">{value}</dd>
    </div>
  );
}
