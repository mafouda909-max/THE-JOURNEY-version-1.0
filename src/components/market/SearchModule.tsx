"use client";

import { useState, type FormEvent } from "react";
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

function recordSearch(detail: Record<string, unknown>) {
  const meta = JSON.stringify({ v: 1, source: "homepage_search", path: "/", ...detail });
  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "search_submitted", meta }),
    keepalive: true,
  }).catch(() => undefined);
}

export function SearchModule() {
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
    recordSearch({ from, to: to.trim() || null, type: type || null, travelers });
    router.push(`/offers?${params.toString()}`);
  }

  const field =
    "w-full rounded-lg border border-outlinev bg-cloud px-4 py-3.5 text-[15px] font-medium text-inkwell outline-none transition-colors placeholder:text-slate/50 focus:border-deep focus:ring-4 focus:ring-deep/10";
  const label =
    "mb-2 block font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-slate";

  return (
    <div className="relative z-20 mx-auto -mt-24 max-w-5xl px-5 md:px-8">
      <form onSubmit={submit} className="rounded-2xl border border-outlinev bg-cloud p-6 shadow-xl shadow-deep/10 md:p-8">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-[1fr_1.2fr_1fr_0.7fr_auto]">
          <div>
            <label htmlFor="search-origin" className={label}>من أين</label>
            <select id="search-origin" value={from} onChange={(event) => setFrom(event.target.value)} className={field}>
              {ORIGINS.map((origin) => (
                <option key={origin}>{origin}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="search-destination" className={label}>إلى أين</label>
            <input
              id="search-destination"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              list="destinations"
              placeholder="أي وجهة في بالك…"
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
              className="flex w-full min-h-12 items-center justify-center gap-2 rounded-lg bg-deep px-7 py-3.5 text-[15px] font-bold text-white transition-all duration-300 hover:bg-horizon focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-deep/20 lg:w-auto"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              ابحث
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-low pt-5">
          <span className="me-2 text-[13px] font-medium text-slate">اختصارات شائعة:</span>
          {popular.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="rounded-full border border-outlinev px-3.5 py-1.5 text-[13px] font-medium text-slate transition-all hover:border-deep hover:bg-wash hover:text-deep focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-deep/20"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </form>
    </div>
  );
}
