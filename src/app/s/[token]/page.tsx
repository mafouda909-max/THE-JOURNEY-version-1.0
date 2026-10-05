import type { Metadata } from "next";
import { publicStandaloneServiceProgress } from "@/lib/service-fulfillment";
import { serviceStatusLabels, type ServiceStatus } from "@/lib/service-fulfillment-domain";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "متابعة الخدمة | صلة", robots: { index: false, follow: false, nocache: true }, referrer: "no-referrer" };
function date(value: string) { return new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }

export default async function ServiceStatusPage({ params }: { params: Promise<{ token: string }> }) {
  const result = await publicStandaloneServiceProgress((await params).token);
  const data = result.body;
  return <main className="mx-auto flex min-h-[70vh] max-w-2xl items-center px-4 py-10 sm:px-6" dir="rtl">
    <section className="w-full min-w-0 rounded-3xl border border-outlinev bg-white p-6 sm:p-9">
      <p className="text-sm font-bold text-deep">صلة · متابعة الخدمة</p>
      {result.status >= 400 ? <><h1 className="mt-3 text-2xl font-bold text-inkwell">المتابعة غير متاحة الآن</h1><p className="mt-4 text-sm leading-relaxed text-slate">{String(data.error)}</p></> : <>
        <p className="mt-3 text-sm text-slate">مقدم من {String(data.officeName)}</p>
        <h1 className="mt-2 break-words text-2xl font-bold text-inkwell">{String(data.serviceName)}</h1>
        <p className="mt-6 rounded-xl bg-low p-4 text-lg font-bold text-deep">{serviceStatusLabels[data.status as ServiceStatus]}</p>
        <dl className="mt-5 space-y-4 text-sm"><div><dt className="text-slate">الموعد المتفق عليه</dt><dd className="mt-1 font-semibold">{date(String(data.dueAt))}</dd></div>
          {typeof data.completedAt === "string" && <div><dt className="text-slate">تاريخ قبول المكتب للتسليم</dt><dd className="mt-1 font-semibold">{date(data.completedAt)}</dd></div>}</dl>
        <p className="mt-5 text-sm leading-relaxed text-slate">يتابع المكتب تنفيذ الخدمة ويراجع التسليم وفق الاتفاق. تواصل معه لأي سؤال عن المستندات أو تفاصيل الطلب.</p>
        <p className="mt-5 text-xs text-slate">الرابط صالح حتى {date(String(data.expiresAt))}. حدّث الصفحة لعرض أحدث حالة.</p>
      </>}
      <p className="mt-6 border-t border-outlinev pt-4 text-xs leading-relaxed text-slate">الرابط خاص بمن استلمه؛ احتفظ به لنفسك.</p>
    </section>
  </main>;
}
