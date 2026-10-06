"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { SilaRelationRail } from "@/components/brand/SilaPrimitives";
import { TRIP_TYPES } from "@/lib/format";

const ORIGINS = ["الرياض", "جدة", "الدمام", "دبي", "القاهرة", "الدوحة"];
const DESTINATIONS = [
  "مكة المكرمة", "تبليسي", "باكو", "إسطنبول", "مراكش", "سراييفو",
  "ماليه", "بوكيت", "أسوان", "دبي", "أملج", "أوروبا",
];

const popular = [
  { label: "عمرة رمضان", href: "/offers?type=umrah" },
  { label: "جورجيا", href: "/offers?to=تبليسي" },
  { label: "أذربيجان", href: "/offers?to=باكو" },
  { label: "تركيا", href: "/offers?to=إسطنبول" },
  { label: "المالديف", href: "/offers?to=ماليه" },
  { label: "شنغن", href: "/offers?type=visa" },
];

function recordSearch(detail: Record<string, unknown>) {
  const meta = JSON.stringify({ v: 1, source: "homepage_search", path: "/", ...detail });
  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "search_submitted", meta }),
    keepalive: true,
  }).catch(() => undefined);
}

export function SearchModule({
  marketplaceEmpty = false,
}: {
  marketplaceEmpty?: boolean;
}) {
  const router = useRouter();
  const [from, setFrom] = useState("الرياض");
  const [to, setTo] = useState("");
  const [type, setType] = useState("");
  const [travelers, setTravelers] = useState(2);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to.trim()) params.set("to", to.trim());
    if (type) params.set("type", type);
    params.set("travelers", String(travelers));
    recordSearch({ from: from || null, to: to.trim() || null, type: type || null, travelers });
    router.push(`/offers?${params.toString()}`);
  }

  function clearOrigin() {
    setFrom("");
  }

  const field =
    "min-h-[52px] w-full rounded-xl border border-outlinev bg-cloud px-4 py-3 text-[15px] font-medium text-inkwell outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-slate/55 focus:border-signal focus:bg-white focus:ring-4 focus:ring-sky/20";
  const label =
    "mb-2 block text-[11px] font-bold text-deep";

  if (marketplaceEmpty) {
    return (
      <div className="relative z-20 mx-auto -mt-16 max-w-5xl px-5 md:-mt-20 md:px-8">
        <section className="overflow-hidden rounded-[1.6rem] border border-outlinev border-t-signal/50 bg-cloud shadow-[0_18px_54px_rgba(8,38,74,.10)]">
          <div className="grid gap-0 md:grid-cols-[1.35fr_.65fr]">
            <div className="p-6 md:p-8">
              <div className="flex items-center justify-between gap-4">
                <div className="sila-eyebrow text-[11px] font-semibold text-signal">ابدأ من الرحلة نفسها</div>
                <SilaRelationRail className="hidden w-28 sm:flex" />
              </div>
              <h2 className="mt-4 text-2xl font-bold tracking-[-0.025em] text-inkwell md:text-4xl">
                قبل ما تدور على عرض، خلّي صلة تفهم الرحلة.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate">
                اكتب الوجهة وما تعرفه الآن. صلة ترتّب الجاهزية والمعلومات الناقصة،
                ولو فيه عرض حقيقي مناسب يظهر داخل نفس السياق بدل ما تبدأ بحث جديد.
              </p>
            </div>

            <div className="flex flex-col justify-center gap-3 border-t border-outlinev bg-low/45 p-6 md:border-r md:border-t-0 md:p-8">
              <Link
                href="/readiness"
                className="sila-attention-primary w-full"
              >
                ابدأ مع صلة
              </Link>
              <Link
                href="/join?mode=agent"
                className="inline-flex min-h-11 items-center justify-center text-sm font-bold text-slate transition-colors hover:text-deep"
              >
                أنا وكيل سفر ←
              </Link>
              <p className="text-[11px] leading-5 text-slate">
                مفيش حجز أو دفع في الخطوة دي. الهدف الأول إن الصورة تبقى أوضح.
              </p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="relative z-20 mx-auto -mt-16 max-w-6xl px-5 md:-mt-20 md:px-8">
      <form
        onSubmit={submit}
        className="overflow-hidden rounded-[1.6rem] border border-outlinev border-t-signal/50 bg-cloud shadow-[0_18px_54px_rgba(8,38,74,.10)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outlinev px-6 py-4 md:px-7">
          <div>
            <div className="text-[11px] font-bold text-signal">بحث سريع</div>
            <div className="mt-1 text-sm font-semibold text-deep">ابدأ بأربع معلومات فقط</div>
          </div>
          <SilaRelationRail label="من السؤال للعرض" className="w-44 max-w-full" />
        </div>

        <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 md:p-7 lg:grid-cols-[1fr_1.2fr_1fr_.72fr_auto]">
          <div>
            <label htmlFor="search-origin" className={label}>الانطلاق</label>
            <select id="search-origin" value={from} onChange={(event) => setFrom(event.target.value)} className={field}>
              <option value="">أي مدينة</option>
              {ORIGINS.map((origin) => (
                <option key={origin} value={origin}>{origin}</option>
              ))}
            </select>
            {from ? (
              <button
                type="button"
                onClick={clearOrigin}
                aria-label={`إزالة فلتر مدينة الانطلاق ${from}`}
                className="mt-2 text-[11px] font-semibold text-slate underline-offset-4 hover:text-deep hover:underline"
              >
                إزالة المدينة
              </button>
            ) : null}
          </div>

          <div>
            <label htmlFor="search-destination" className={label}>الوجهة</label>
            <input
              id="search-destination"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              list="destinations"
              placeholder="مثال: إسطنبول"
              className={field}
            />
            <datalist id="destinations">
              {DESTINATIONS.map((destination) => (
                <option key={destination} value={destination} />
              ))}
            </datalist>
          </div>

          <div>
            <label htmlFor="search-trip-type" className={label}>نوع الرحلة</label>
            <select id="search-trip-type" value={type} onChange={(event) => setType(event.target.value)} className={field}>
              <option value="">كل الأنواع</option>
              {TRIP_TYPES.map((tripType) => (
                <option key={tripType.key} value={tripType.key}>
                  {tripType.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="search-travelers" className={label}>المسافرون</label>
            <input
              id="search-travelers"
              type="number"
              min={1}
              max={14}
              inputMode="numeric"
              value={travelers}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (Number.isInteger(next) && next >= 1 && next <= 14) setTravelers(next);
              }}
              className={`${field} tnum`}
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-signal px-6 py-3 text-[15px] font-bold text-white transition-[background-color,transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:bg-horizon hover:shadow-[0_10px_26px_rgba(46,111,216,.18)] focus-visible:ring-4 focus-visible:ring-sky/30 lg:w-auto"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              ابحث
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-outlinev bg-low/35 px-6 py-4 md:px-7">
          <span className="text-[11px] font-bold text-slate">اختصارات:</span>
          {popular.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="text-[12px] font-semibold text-slate underline-offset-4 transition-colors hover:text-signal hover:underline"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </form>
    </div>
  );
}
