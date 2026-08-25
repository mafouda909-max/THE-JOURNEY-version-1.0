import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchModule } from "@/components/search/SearchModule";
import { OfferCard } from "@/components/offers/OfferCard";
import {
  DataSourceUnavailableError,
  type PublicOfferRow,
} from "@/lib/data/types";
import {
  getDiscoveryStatsServer,
  listFeaturedOffersServer,
} from "@/lib/data/agents";
import { formatCount } from "@/lib/format";

/**
 * HOME — SCREEN_MAP Zone1: Nav(RTL) · Hero search · Trust stats · Featured offers.
 * Data via anon server client (views + RLS); honest placeholders while the
 * source is unavailable (pre-provisioning).
 */
export default async function HomePage() {
  let stats: Awaited<ReturnType<typeof getDiscoveryStatsServer>> | null = null;
  let featured: PublicOfferRow[] = [];
  try {
    [stats, featured] = await Promise.all([
      getDiscoveryStatsServer(),
      listFeaturedOffersServer(6),
    ]);
  } catch (e) {
    if (!(e instanceof DataSourceUnavailableError)) throw e;
  }

  return (
    <div className="min-h-dvh">
      <SiteHeader />

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pb-10 pt-10 md:px-6 md:pt-16 lg:px-10">
        <h1 className="max-w-2xl text-display-md text-on-surface md:text-display-lg">
          مسافر منين ورايح فين؟
        </h1>
        <p className="mb-8 mt-3 max-w-xl text-body-lg text-on-surface-variant">
          قارن عروض وكلاء السفر الموثوقين من مكان واحد. اعرف رحلتك. واختر بثقة.
        </p>
        <SearchModule />
      </section>

      {/* Trust stats */}
      <section aria-label="أرقام المنصة" className="mx-auto max-w-7xl px-4 md:px-6 lg:px-10">
        <div className="grid gap-4 sm:grid-cols-3">
          <TrustStat icon="verified" label="وكلاء موثّقون" value={stats?.agents} />
          <TrustStat icon="local_offer" label="عروض نشطة" value={stats?.offers} />
          <TrustStat icon="location_city" label="مدن مغطاة" value={stats?.cities} />
        </div>
      </section>

      {/* Featured offers */}
      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 lg:px-10">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-headline-md text-on-surface">عروض مميزة</h2>
          <ButtonLink href="/offers" variant="ghost" size="sm">
            كل العروض
            <Icon name="arrow_back" />
          </ButtonLink>
        </div>

        {featured.length === 0 ? (
          <EmptyState
            iconName="local_offer"
            title="لا توجد عروض منشورة بعد"
            description="عروض الوكلاء الموثوقين ستظهر هنا فور نشرها."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {featured.map((o) => (
              <OfferCard key={o.id} offer={o} />
            ))}
          </div>
        )}
      </section>

      <footer className="border-t border-outline-variant py-8 text-center text-label-md text-on-surface-variant">
        الرحلة © 2026 — منصة موثوقة لاكتشاف عروض السفر
      </footer>
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-outline-variant bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6 lg:px-10">
        <ButtonLink href="/" variant="ghost" className="gap-2 !min-h-0 px-2 py-1">
          <span aria-hidden className="size-7 rounded-full bg-primary" />
          <span className="text-title-lg font-bold">الرحلة</span>
        </ButtonLink>

        {/* Account entry lands in Slice 3 (auth). Disabled = honest, not a dead link. */}
        <button
          disabled
          title="تسجيل الدخول يفتح قريبًا"
          className="flex size-11 items-center justify-center rounded-full text-on-surface-variant opacity-50"
        >
          <Icon name="account_circle" className="text-[26px]" />
        </button>
      </div>
    </header>
  );
}

function TrustStat({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value?: number | null;
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span aria-hidden className="flex size-11 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
        <Icon name={icon} />
      </span>
      <span>
        <span className="block tabular-nums text-title-lg text-on-surface">
          {value === null || value === undefined ? "—" : formatCount(value)}
        </span>
        <span className="block text-label-md text-on-surface-variant">{label}</span>
      </span>
    </Card>
  );
}
