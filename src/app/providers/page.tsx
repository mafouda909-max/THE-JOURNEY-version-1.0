import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Clock3, MapPin, Search, Star } from "lucide-react";
import { SilaPageIntro } from "@/components/brand/SilaPageIntro";
import { AgentTrustChip } from "@/components/market/AgentTrust";
import { SilaArrowIcon } from "@/components/brand/SilaIcons";
import { getPublicProviders } from "@/lib/data";
import { filterPublicProviders } from "@/lib/provider-directory";
import { TRIP_TYPES } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "دليل مقدمي خدمات السفر | صلة",
  description: "دليل عام لوكالات ووكلاء السفر ذوي الأدلة الحالية التي راجعتها صلة، مع التخصصات والعروض المنشورة فعليًا.",
};

type SearchParams = Record<string, string | string[] | undefined>;

function queryHref(current: {
  q: string;
  city: string;
  kind: string;
  category: string;
}, update: Partial<{ q: string; city: string; kind: string; category: string }>) {
  const next = { ...current, ...update };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.city) params.set("city", next.city);
  if (next.kind) params.set("kind", next.kind);
  if (next.category) params.set("category", next.category);
  const query = params.toString();
  return query ? "/providers?" + query : "/providers";
}

export default async function ProvidersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const value = (key: string) => typeof params[key] === "string" ? params[key] as string : "";
  const filters = {
    q: value("q").trim().slice(0, 100),
    city: value("city").trim().slice(0, 80),
    kind: value("kind"),
    category: value("category"),
  };

  const providers = await getPublicProviders();
  const shown = filterPublicProviders(providers, filters);
  const availableCategories = TRIP_TYPES.filter((category) =>
    providers.some((provider) => provider.offerCategories.includes(category.key)),
  );

  return (
    <main className="mx-auto max-w-7xl px-5 pb-24 pt-12 md:px-8 md:pt-16">
      <SilaPageIntro
        eyebrow="SILA · PROVIDER DIRECTORY"
        title="دليل مقدمي خدمات السفر"
        description="الدليل الحالي يعرض وكالات ووكلاء سفر اجتازوا مراجعة أدلة الهوية والنشاط والكيان المطلوبة حسب نوع الحساب. فئات العروض تُعرض عندما يوجد لها عرض منشور فعليًا؛ ولا تعني ظهور الفئة وجود مخزون حي أو حجز مؤكد."
        meta={
          <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
            <span className="rounded-full bg-air px-3 py-1.5 text-deep">أدلة مراجعة حالية</span>
            <span className="rounded-full bg-low px-3 py-1.5 text-slate">فئات مرتبطة بعروض منشورة</span>
            <span className="rounded-full bg-low px-3 py-1.5 text-slate">التواصل مع مقدم الخدمة مباشرة</span>
          </div>
        }
      />

      <section className="mb-8 rounded-2xl border border-outlinev bg-cloud p-4 md:p-5">
        <form action="/providers" method="GET" className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
          <label className="relative">
            <span className="sr-only">ابحث عن مقدم خدمة أو تخصص</span>
            <Search className="absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate" />
            <input
              name="q"
              defaultValue={filters.q}
              maxLength={100}
              placeholder="اسم الوكالة، الوكيل، التخصص أو الخدمة…"
              className="min-h-12 w-full rounded-xl border border-outlinev bg-low py-3 pe-4 ps-10 text-sm outline-none focus:border-signal"
            />
          </label>
          <label>
            <span className="sr-only">المدينة أو الدولة</span>
            <input
              name="city"
              defaultValue={filters.city}
              maxLength={80}
              placeholder="المدينة أو الدولة"
              className="min-h-12 w-full rounded-xl border border-outlinev bg-low px-4 py-3 text-sm outline-none focus:border-signal"
            />
          </label>
          <input type="hidden" name="kind" value={filters.kind} />
          <input type="hidden" name="category" value={filters.category} />
          <button type="submit" className="min-h-12 rounded-xl bg-deep px-6 py-3 text-sm font-bold text-white hover:bg-horizon">
            بحث في الدليل
          </button>
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="me-1 text-[11px] font-bold text-slate">نوع مقدم الخدمة</span>
          <Link href={queryHref(filters, { kind: "" })} className={"rounded-full border px-3 py-1.5 text-xs font-semibold " + (!filters.kind ? "border-deep bg-deep text-white" : "border-outlinev bg-low text-slate")}>
            الكل
          </Link>
          <Link href={queryHref(filters, { kind: "agency" })} className={"rounded-full border px-3 py-1.5 text-xs font-semibold " + (filters.kind === "agency" ? "border-deep bg-deep text-white" : "border-outlinev bg-low text-slate")}>
            وكالات السفر
          </Link>
          <Link href={queryHref(filters, { kind: "individual" })} className={"rounded-full border px-3 py-1.5 text-xs font-semibold " + (filters.kind === "individual" ? "border-deep bg-deep text-white" : "border-outlinev bg-low text-slate")}>
            وكلاء مستقلون
          </Link>
        </div>

        {availableCategories.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="me-1 text-[11px] font-bold text-slate">فئات العروض الموجودة</span>
            <Link href={queryHref(filters, { category: "" })} className={"rounded-full border px-3 py-1.5 text-xs font-semibold " + (!filters.category ? "border-sky bg-sky text-deep" : "border-outlinev bg-low text-slate")}>
              جميع الفئات
            </Link>
            {availableCategories.map((category) => (
              <Link
                key={category.key}
                href={queryHref(filters, { category: category.key })}
                className={"rounded-full border px-3 py-1.5 text-xs font-semibold " + (filters.category === category.key ? "border-sky bg-sky text-deep" : "border-outlinev bg-low text-slate")}
              >
                {category.label}
              </Link>
            ))}
          </div>
        ) : null}
      </section>

      <div className="mb-5 flex items-center justify-between gap-3 text-xs text-slate">
        <p>مقدمو الخدمة المطابقون: <strong className="tnum text-deep">{shown.length}</strong></p>
        <Link href="/providers" className="font-semibold text-deep underline underline-offset-4">مسح البحث والفلاتر</Link>
      </div>

      {shown.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-outlinev bg-cloud px-6 py-16 text-center">
          <h2 className="text-xl font-bold text-inkwell">
            {providers.length === 0 ? "لا توجد ملفات عامة مؤهلة للعرض حتى الآن." : "لا توجد نتائج تطابق البحث الحالي."}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate">
            {providers.length === 0
              ? "لا نعرض ملفات غير مكتملة الأدلة أو ملفات انتهت صلاحية مستنداتها. يمكن لمقدم الخدمة بدء التسجيل ورفع الأدلة المطلوبة للمراجعة."
              : "جرّب تغيير التخصص أو الموقع أو إزالة بعض الفلاتر."}
          </p>
          <Link href={providers.length === 0 ? "/join?mode=agent" : "/providers"} className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-deep px-6 py-3 text-sm font-bold text-white hover:bg-horizon">
            {providers.length === 0 ? "بدء تسجيل مقدم خدمة" : "عرض الدليل كاملًا"}
          </Link>
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((provider) => (
            <Link
              key={provider.id}
              href={"/agents/" + provider.id}
              className="sila-window sila-motion-safe group flex h-full flex-col overflow-hidden border border-outlinev bg-cloud shadow-[0_8px_30px_rgba(8,38,74,0.05)] transition-all duration-300 hover:-translate-y-1 hover:border-sky hover:shadow-[0_18px_44px_rgba(8,38,74,0.1)]"
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-low">
                <Image
                  src={provider.photoUrl}
                  alt={provider.displayName}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover object-top transition-transform duration-700 group-hover:scale-[1.04]"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-inkwell/85 to-transparent p-4 pt-12">
                  <div className="text-lg font-bold text-white">{provider.displayName}</div>
                  <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/70">{provider.latinName}</div>
                </div>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-full bg-air px-2.5 py-1 text-[10px] font-bold text-deep">{provider.providerKindLabel}</span>
                  <AgentTrustChip trust={provider.trust} compact />
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-[12px] text-slate">
                  <MapPin className="h-3.5 w-3.5 text-deep" />
                  {provider.city}، {provider.country}
                </div>
                <p className="mt-3 line-clamp-3 text-xs leading-6 text-slate">{provider.bio}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {provider.specialtyTags.map((tag) => (
                    <span key={tag} className="rounded-full bg-parchment px-2.5 py-1 text-[10px] font-semibold text-stone">{tag}</span>
                  ))}
                </div>
                {provider.offerCategories.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {provider.offerCategories.map((categoryKey) => (
                      <span key={categoryKey} className="rounded-full border border-outlinev px-2.5 py-1 text-[10px] text-slate">
                        {TRIP_TYPES.find((item) => item.key === categoryKey)?.label ?? categoryKey}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-[10px] text-slate">لا توجد عروض منشورة حاليًا</p>
                )}
                <div className="mt-auto grid grid-cols-3 gap-2 border-t border-low pt-4 text-center">
                  <div>
                    <div className="tnum inline-flex items-center gap-1 font-bold text-gold">
                      <Star className="h-3.5 w-3.5 fill-gold" />{provider.avgRating.toFixed(1)}
                    </div>
                    <div className="text-[10px] text-slate">{provider.reviewCount} تقييم</div>
                  </div>
                  <div>
                    <div className="tnum font-bold text-deep">{provider.responseRate}%</div>
                    <div className="text-[10px] text-slate">استجابة</div>
                  </div>
                  <div>
                    <div className="tnum inline-flex items-center gap-1 font-bold text-deep">
                      {provider.publishedOfferCount}<Clock3 className="h-3 w-3" />
                    </div>
                    <div className="text-[10px] text-slate">عرض منشور</div>
                  </div>
                </div>
                <div className="mt-4 inline-flex items-center gap-2 text-[12px] font-bold text-deep">
                  الملف والتواصل
                  <SilaArrowIcon className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
