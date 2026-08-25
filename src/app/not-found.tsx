import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <p dir="ltr" className="tabular-nums text-display-lg font-bold text-primary">
        404
      </p>
      <h1 className="text-title-lg text-on-surface">الصفحة غير موجودة</h1>
      <p className="text-body-sm text-on-surface-variant">
        يبدو أنك وصلت إلى رحلة لم تُرسم بعد.
      </p>
      <Link
        href="/"
        className="mt-2 flex min-h-11 items-center rounded-md bg-primary px-4 text-label-lg text-on-primary transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        العودة للرئيسية
      </Link>
    </main>
  );
}
