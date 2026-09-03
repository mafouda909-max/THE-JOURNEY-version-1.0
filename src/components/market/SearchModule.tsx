"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
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

  function submit() {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (type) params.set("type", type);
    if (travelers) params.set("travelers", String(travelers));
    router.push(`/offers?${params.toString()}`);
  }

  const field =
    "w-full rounded-lg border border-outlinev bg-cloud px-4 py-3.5 text-[15px] font-medium text-inkwell outline-none transition-colors placeholder:text-slate/50 focus:border-deep focus:ring-4 focus:ring-deep/10";
  const label =
    "mb-2 flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-slate";

  return (
    <div className="relative z-20 mx-auto -mt-24 max-w-5xl px-5 md:px-8">
      <div className="rounded-2xl border border-outlinev bg-cloud p-6 shadow-xl shadow-deep/10 md:p-8">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-[1fr_1.2fr_1fr_0.7fr_auto]">
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
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-deep px-7 py-3.5 text-[15px] font-bold text-white transition-all duration-300 hover:bg-horizon lg:w-auto"
            >
              <Search className="h-4 w-4" />
              ابحث
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-low pt-5">
          <span className="me-2 text-[13px] font-medium text-slate">الأكثر بحثاً:</span>
          {popular.map((p) => (
            <Link
              key={p.label}
              href={p.href}
              className="rounded-full border border-outlinev px-3.5 py-1.5 text-[13px] font-medium text-slate transition-all hover:border-deep hover:bg-wash hover:text-deep"
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
