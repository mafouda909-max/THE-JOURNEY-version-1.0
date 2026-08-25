import { Suspense } from "react";
import type { Metadata } from "next";
import { OffersExplorer } from "@/components/search/OffersExplorer";

export const metadata: Metadata = {
  title: "عروض السفر | الرحلة",
  description:
    "ابحث وقارن عروض السفر من وكلاء موثّقين — طيران، برامج، تأشيرات، عمرة وفنادق.",
};

export default function OffersPage() {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-outline-variant bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-4 md:px-6 lg:px-10">
          <h1 className="text-headline-md text-on-surface">نتائج البحث</h1>
        </div>
      </header>
      <Suspense
        fallback={
          <div className="mx-auto max-w-7xl px-4 py-10 md:px-6 lg:px-10">
            <p className="text-body-md text-on-surface-variant">جارٍ التحميل…</p>
          </div>
        }
      >
        <OffersExplorer />
      </Suspense>
    </div>
  );
}
