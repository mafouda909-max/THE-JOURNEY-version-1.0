export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col items-center justify-center gap-6 px-4 text-center md:px-6 lg:px-10">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="inline-block size-8 rounded-full bg-primary"
        />
        <h1 className="text-display-md text-on-surface">الرحلة</h1>
      </div>

      <p className="text-body-lg text-on-surface-variant">
        اعرف رحلتك. واختر بثقة.
      </p>

      {/* Token smoke-test: radius semantics + semantic containers + shadow scale */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <span className="rounded-full bg-success-container px-3 py-1 text-label-lg text-on-success-container">
          وكيل موثّق
        </span>
        <span className="rounded-full bg-warning-container px-3 py-1 text-label-lg text-on-warning-container">
          قيد المراجعة
        </span>
        <span className="rounded-sm bg-surface-container px-3 py-1 text-label-lg text-on-surface-variant">
          وسم
        </span>
      </div>

      <div className="mt-6 w-full max-w-sm rounded-md bg-surface p-6 text-start shadow-sm">
        <p className="text-title-md">بطاقة تجربة الـtokens</p>
        <p className="mt-2 tabular-nums text-headline-md text-primary">
          1,250{" "}
          <span className="text-body-md font-normal text-on-surface-variant">
            EGP
          </span>
        </p>
        <p className="mt-2 text-body-sm text-on-surface-variant">
          Slice 0 — Foundation · build/lint/typecheck green
        </p>
      </div>
    </main>
  );
}
