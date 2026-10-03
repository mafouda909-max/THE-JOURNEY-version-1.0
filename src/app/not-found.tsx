import Link from "next/link";
import { SilaSearchIcon } from "@/components/brand/SilaIcons";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center px-5 text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-[1.75rem] border border-sky/50 bg-air text-signal shadow-[0_12px_36px_rgba(8,38,74,0.06)]">
        <SilaSearchIcon className="h-9 w-9" />
      </span>
      <div className="sila-eyebrow mt-8 text-[11px] font-semibold text-signal">مش كل طريق لازم يكمل</div>
      <h1 className="mt-3 text-4xl font-bold tracking-[-0.035em] text-inkwell md:text-6xl">هذه الصفحة غير موجودة.</h1>
      <p className="mt-4 max-w-md leading-relaxed text-slate">
        الصفحة التي تبحث عنها انتهت صلاحيتها أو لم توجد — كعرض سفر مضلل،
        كان الأفضل ألا تجدها.
      </p>
      <div className="mt-8 flex items-center gap-3">
        <Link
          href="/offers"
          className="rounded-2xl bg-signal px-6 py-3.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-horizon"
        >
          تصفّح العروض
        </Link>
        <Link
          href="/"
          className="rounded-2xl border border-outlinev bg-cloud px-6 py-3 text-sm font-bold text-deep transition-all hover:border-sky hover:text-signal"
        >
          الرئيسية
        </Link>
      </div>
    </div>
  );
}
