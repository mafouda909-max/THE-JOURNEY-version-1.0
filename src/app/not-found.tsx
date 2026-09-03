import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-5 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-wash text-deep">
        <Compass className="h-8 w-8" strokeWidth={1.5} />
      </span>
      <h1 className="mt-8 text-4xl font-bold text-inkwell md:text-6xl">هذه الوجهة غير موجودة.</h1>
      <p className="mt-4 max-w-md leading-relaxed text-slate">
        الصفحة التي تبحث عنها انتهت صلاحيتها أو لم توجد — كعرض سفر مضلل،
        كان الأفضل ألا تجدها.
      </p>
      <div className="mt-8 flex items-center gap-3">
        <Link
          href="/offers"
          className="rounded-lg bg-deep px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-horizon"
        >
          تصفّح العروض
        </Link>
        <Link
          href="/"
          className="rounded-lg border-2 border-deep px-6 py-3 text-sm font-bold text-deep transition-colors hover:bg-deep hover:text-white"
        >
          الرئيسية
        </Link>
      </div>
    </div>
  );
}
