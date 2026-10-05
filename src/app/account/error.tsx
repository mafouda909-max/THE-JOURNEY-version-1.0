"use client";

export default function WorkspaceError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <div className="sila-window border border-outlinev bg-cloud p-6">
        <h1 className="text-2xl font-bold text-deep">تعذر تحميل مساحة العمل</h1>
        <p role="alert" className="mt-3 text-sm leading-7 text-slate">
          حاول إعادة التحميل. لا يمكن تأكيد تحديث بيانات الحساب من هذه الصفحة
          حاليًا.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-signal px-5 py-3 text-sm font-bold text-white"
        >
          إعادة المحاولة
        </button>
      </div>
    </div>
  );
}
