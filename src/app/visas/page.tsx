import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, ShieldCheck, Calendar, Plane, CheckCircle2, AlertCircle } from "lucide-react";
import { SilaPageIntro } from "@/components/brand/SilaPageIntro";
import { listVisaGuides, type VisaType } from "@/lib/visas";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "التأشيرات وإجراءات السفر الرسمية",
  description:
    "دليل متطلبات التأشيرات والدخول الموثّق بمصادر حكومية رسمية وتواريخ فحص واضحة — بدون تكهنات.",
};

const TYPE_BADGE_STYLE: Record<VisaType, { bg: string; text: string; border: string }> = {
  visa_free: { bg: "bg-emerald-50", text: "text-emerald-800", border: "border-emerald-200" },
  evisa: { bg: "bg-sky/20", text: "text-deep", border: "border-sky/40" },
  on_arrival: { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200" },
  embassy_required: { bg: "bg-rose-50", text: "text-rose-800", border: "border-rose-200" },
};

export default async function VisasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const nationality = typeof params.nationality === "string" ? params.nationality : "";
  const destination = typeof params.destination === "string" ? params.destination : "";

  const guides = listVisaGuides({ nationality, destination });

  return (
    <div className="mx-auto max-w-7xl px-5 pb-24 pt-12 md:px-8 md:pt-16">
      <SilaPageIntro
        eyebrow="Official Border Knowledge · أدلة السفر الرسمية"
        title="متطلبات التأشيرات والدخول بالمصادر الرسمية."
        description="لا نعتمد على شائعات المجموعات أو معلومات قديمة. كل تأشيرة معروضة هنا مربوطة ببوابة الحكومة الرسمية وتاريخ التحقق وشروط كاونتر المطار."
        meta={
          <div className="flex flex-wrap gap-2 text-[12px] font-semibold">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-verifiedbg px-3 py-1.5 text-verified">
              <ShieldCheck className="h-3.5 w-3.5" />
              مراجعة يدوية دورية للمصادر
            </span>
            <span className="rounded-full bg-air px-3 py-1.5 text-deep">
              بوابات حكومية رسمية فقط
            </span>
            <span className="rounded-full bg-low px-3 py-1.5 text-slate">
              تدقيق بشري غير آلي
            </span>
          </div>
        }
      />

      {/* Corridor Filter Chips */}
      <div className="mb-8 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate">مسارات شائعة:</span>
        <Link
          href="/visas"
          className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
            !destination ? "bg-deep text-white" : "border border-outlinev bg-cloud text-slate hover:bg-low"
          }`}
        >
          الكل
        </Link>
        <Link
          href="/visas?destination=turkey"
          className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
            destination === "turkey" ? "bg-deep text-white" : "border border-outlinev bg-cloud text-slate hover:bg-low"
          }`}
        >
          تركيا
        </Link>
        <Link
          href="/visas?destination=saudi-arabia"
          className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
            destination === "saudi-arabia" ? "bg-deep text-white" : "border border-outlinev bg-cloud text-slate hover:bg-low"
          }`}
        >
          السعودية
        </Link>
        <Link
          href="/visas?destination=georgia"
          className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
            destination === "georgia" ? "bg-deep text-white" : "border border-outlinev bg-cloud text-slate hover:bg-low"
          }`}
        >
          جورجيا
        </Link>
        <Link
          href="/visas?destination=maldives"
          className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
            destination === "maldives" ? "bg-deep text-white" : "border border-outlinev bg-cloud text-slate hover:bg-low"
          }`}
        >
          المالديف
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {guides.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-amber-200 bg-amber-50/60 p-8 text-center md:p-12">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-800">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-xl font-bold text-inkwell">
              هذا المسار غير مغطى بدليل رسمي مدقق يدوياً حتى الآن
            </h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate">
              في صِلة، لا نعرض بيانات مبنية على التكهن أو الكشط الآلي غير الموثق. نعتمد فقط على مراجعات يدوية للبوابات الحكومية.
            </p>
            <div className="mx-auto mt-6 max-w-lg rounded-xl border border-amber-200/80 bg-white p-5 text-right text-xs">
              <p className="font-bold text-amber-900 mb-2">إرشادات التحقق الرسمية للمسافر:</p>
              <ul className="space-y-1.5 text-slate">
                <li>• تواصل مع سفارة أو قنصلية دولة الوجهة الرسمية في بلدك قبل ترتيبات السفر.</li>
                <li>• راجع البوابة الإلكترونية المعتمدة لوزارة الخارجية أو دائرة الهجرة للدولة المقصودة.</li>
                <li>• تأكد من شرط سريان جواز السفر (غالباً 6 أشهر كحد أدنى) وحجز تذكرة العودة المؤكدة.</li>
              </ul>
            </div>
            <div className="mt-6">
              <Link
                href="/visas"
                className="inline-flex items-center gap-2 rounded-xl bg-deep px-5 py-2.5 text-xs font-bold text-white transition hover:bg-horizon"
              >
                عرض كافة المسارات المدققة رسمياً
              </Link>
            </div>
          </div>
        ) : (
          guides.map((guide) => {
            const badge = TYPE_BADGE_STYLE[guide.visaType] ?? TYPE_BADGE_STYLE.evisa;
            const verifiedDateFormatted = new Date(guide.lastVerifiedAt).toLocaleDateString("ar-EG", {
              year: "numeric",
              month: "long",
              day: "numeric",
            });

            return (
              <article
                key={guide.id}
                className="sila-window relative flex flex-col justify-between overflow-hidden border border-outlinev bg-cloud p-6 shadow-[0_8px_30px_rgba(8,38,74,0.05)] md:p-8"
              >
                <div>
                  {/* Header */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs uppercase tracking-wider text-slate">
                          من {guide.nationalityCountry} إلى
                        </span>
                      </div>
                      <h2 className="mt-1 text-2xl font-bold tracking-tight text-inkwell md:text-3xl">
                        {guide.destinationCountry}
                        <span className="ms-2 font-mono text-sm font-normal text-slate/70">
                          ({guide.destinationCountryEn})
                        </span>
                      </h2>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${badge.bg} ${badge.text} ${badge.border}`}
                    >
                      {guide.visaTypeLabel}
                    </span>
                  </div>

                  {/* Source & Verified Stamp */}
                  <div className="mt-4 rounded-xl border border-outlinev/70 bg-low/40 p-3.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-deep">المصدر الرسمي المعتمد:</span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-verified">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        تدقيق رسمي يدوي
                      </span>
                    </div>
                    <p className="mt-1 font-medium text-slate">{guide.officialSourceName}</p>
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate/80">
                      <Calendar className="h-3 w-3 text-slate/60" />
                      <span>تاريخ آخر مراجعة يدوية:</span>
                      <span className="tnum font-semibold text-deep">{verifiedDateFormatted}</span>
                      <span className="text-[10px] text-slate/60">(مراجعة دورية للمصادر الرسمية)</span>
                    </div>
                  </div>

                  {/* Requirements Checklist */}
                  <div className="mt-5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate">
                      المستندات والمتطلبات الأساسية
                    </h3>
                    <ul className="mt-2.5 space-y-2">
                    {guide.entryRequirements.map((req, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-sm leading-relaxed text-slate">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-verified" />
                        <span>{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Airport Procedures */}
                {guide.airportProcedures && (
                  <div className="mt-5 rounded-xl border border-sky/20 bg-air/25 p-4 text-xs leading-relaxed text-deep">
                    <div className="flex items-center gap-1.5 font-bold text-deep">
                      <Plane className="h-3.5 w-3.5 text-signal" />
                      إجراءات الوصول والمطار
                    </div>
                    <p className="mt-1.5 text-slate">{guide.airportProcedures}</p>
                  </div>
                )}

                {/* Notes */}
                {guide.notes && (
                  <div className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-slate/85">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                    <span>{guide.notes}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-outlinev pt-4">
                <a
                  href={guide.officialPortalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-deep px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-horizon"
                >
                  <span>البوابة الحكومية الرسمية</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>

                <Link
                  href={`/destinations/${guide.destinationSlug}`}
                  className="rounded-xl border border-outlinev bg-low px-4 py-2.5 text-xs font-bold text-deep transition hover:border-deep"
                >
                  استكشف رحلات {guide.destinationCountry}
                </Link>
              </div>
            </article>
          );
        }))}
      </div>
    </div>
  );
}
