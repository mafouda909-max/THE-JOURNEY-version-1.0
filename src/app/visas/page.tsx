import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { VisaExplorer } from "@/components/visas/VisaExplorer";
import { listVisaGuidesServer } from "@/lib/data/visas";

export const metadata: Metadata = {
  title: "دليل التأشيرات والاكتشاف | صلة - THE JOURNEY",
  description:
    "استكشف متطلبات التأشيرات الرسمية لأشهر الوجهات السياحية، الشروط، الرسوم، والروابط الحكومية المباشرة الموثقة.",
};

export default async function VisasPage() {
  const guides = await listVisaGuidesServer();

  return (
    <div className="min-h-dvh bg-surface">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-outline-variant bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6 lg:px-10">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <span aria-hidden className="size-7 rounded-full bg-[#1A2B6D]" />
              <span className="text-title-lg font-bold text-[#1A2B6D]">صلة</span>
              <span className="text-label-sm text-on-surface-variant font-medium">| التأشيرات والاكتشاف</span>
            </Link>
            <nav className="hidden md:flex items-center gap-4 text-label-md">
              <Link href="/" className="text-on-surface-variant hover:text-primary transition-colors">
                الرئيسية
              </Link>
              <Link href="/offers" className="text-on-surface-variant hover:text-primary transition-colors">
                عروض السفر
              </Link>
              <Link href="/visas" className="font-bold text-[#1A2B6D]">
                التأشيرات والاكتشاف
              </Link>
              <Link href="/community" className="text-on-surface-variant hover:text-primary transition-colors">
                المجتمع
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/offers"
              className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant px-3.5 py-1.5 text-label-sm font-medium text-on-surface hover:bg-surface-container"
            >
              <Icon name="local_offer" className="text-sm text-primary" />
              تصفح العروض
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Header */}
      <section className="border-b border-outline-variant bg-gradient-to-b from-emerald-500/5 to-transparent py-10 md:py-14">
        <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-10">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-label-sm font-bold text-emerald-900">
              <Icon name="verified" className="text-sm text-emerald-700" />
              بوابة التحقق الحكومية الموثقة
            </span>
            <h1 className="mt-3 text-display-sm md:text-display-md font-bold text-[#1A2B6D]">
              دليل متطلبات وتأشيرات السفر
            </h1>
            <p className="mt-2 text-body-lg text-on-surface-variant">
              اعرف شروط دخول وجهتك بدقة وتحديث مستمر. نميّز لك المصادر الحكومية الرسمية، ونزودك بروابط
              التقديم المباشرة لحمايتك من التكاليف الإضافية والمواقع غير المعتمدة.
            </p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-4 py-8 md:px-6">
        <VisaExplorer initialGuides={guides} />
      </main>

      <footer className="mt-16 border-t border-outline-variant py-8 text-center text-label-md text-on-surface-variant">
        صلة © 2026 — منصة السفر والتأشيرات الموثوقة
      </footer>
    </div>
  );
}
