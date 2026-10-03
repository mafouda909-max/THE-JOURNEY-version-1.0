"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SilaSearchIcon } from "@/components/brand/SilaIcons";
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

export function SearchModule() {
  const router = useRouter();
  const [from, setFrom] = useState("الرياض");
  const [to, setTo] = useState("");
  const [type, setType] = useState("");
  const [travelers, setTravelers] = useState(2);

  const tripType = TRIP_TYPES.find((item) => item.key === type)?.label;
  const contextSummary = [
    from ? `من ${from}` : null,
    to ? `إلى ${to}` : null,
    tripType ?? null,
    travelers ? `${travelers} ${travelers === 1 ? "مسافر" : "مسافرين"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  function submit() {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (type) params.set("type", type);
    if (travelers) params.set("travelers", String(travelers));
    router.push(`/offers?${params.toString()}`);
  }

  const field =
    "w-full rounded-2xl border border-outlinev bg-low/70 px-4 py-3.5 text-[15px] font-semibold text-inkwell outline-none transition-all placeholder:text-slate/50 hover:border-sky focus:border-signal focus:bg-cloud focus:ring-4 focus:ring-signal/10";
  const label =
    "mb-2 text-[12px] font-semibold text-slate";

  return (
    <div className="relative z-20 mx-auto -mt-20 max-w-6xl px-5 md:px-8">
      <div className="sila-window border border-outlinev bg-cloud p-3 shadow-[0_24px_80px_rgba(8,38,74,0.12)] md:p-4">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3 px-3 pb-4 pt-2 md:px-4">
          <div>
            <div className="sila-eyebrow text-[11px] font-semibold text-signal">ابدأ من المعلومة</div>
            <div className="mt-1 text-lg font-bold text-deep">حدد ما تعرفه، والباقي نساعدك تقارنه.</div>
          </div>
          <div className="hidden items-center gap-2 text-[11px] font-semibold text-slate md:flex">
            <span className="h-2 w-2 rounded-full bg-signal" />
            <span className="h-2 w-2 rounded-full bg-sky" />
            بحث منظم قبل التواصل
          </div>
        </div>

        <div className="rounded-[1.25rem] border border-outlinev/80 bg-mist/70 p-4 md:p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1.2fr_1fr_0.7fr_auto]">
          <div>
            <div className={label}>من أين</div>
            <select value={from} onChange={(e) => setFrom(e.target.value)} className={field}>
              {ORIGINS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
          <div>
            <div className={label}>إلى أين</div>
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              list="destinations"
              placeholder="أي وجهة في بالك…"
              className={field}
            />
            <datalist id="destinations">
              {DESTINATIONS.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </div>
          <div>
            <div className={label}>نوع الرحلة</div>
            <select value={type} onChange={(e) => setType(e.target.value)} className={field}>
              <option value="">كل الأنواع</option>
              {TRIP_TYPES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className={label}>المسافرون</div>
            <input
              type="number"
              min={1}
              max={14}
              value={travelers}
              onChange={(e) => setTravelers(Number(e.target.value))}
              className={`${field} tnum`}
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={submit}
              className="sila-motion-safe flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-signal px-7 py-3.5 text-[15px] font-bold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-horizon lg:w-auto"
            >
              <SilaSearchIcon className="h-5 w-5" />
              ابحث
            </button>
          </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-3 pb-2 pt-3 md:px-4">
          <div className="flex min-w-0 items-center gap-2 text-[12px] font-semibold text-deep">
            <span className="h-2 w-2 shrink-0 rounded-full bg-signal" />
            <span className="truncate">{contextSummary || "ابدأ باختيار وجهتك أو نوع الرحلة"}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
          <span className="me-2 text-[13px] font-medium text-slate">الأكثر بحثاً:</span>
          {popular.map((p) => (
            <Link
              key={p.label}
              href={p.href}
              className="rounded-full border border-outlinev bg-cloud px-3.5 py-1.5 text-[13px] font-medium text-slate transition-all hover:border-sky hover:bg-air/70 hover:text-deep"
            >
              {p.label}
            </Link>
          ))}
          </div>
        </div>
      </div>
    </div>
  );
}
