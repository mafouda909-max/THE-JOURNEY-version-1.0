import Link from "next/link";
import type { PublicVisaGuideRow } from "@/lib/data/types";
import { Icon } from "@/components/ui/Icon";

const VISA_TYPE_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  visa_free: { label: "بدون تأشيرة (إعفاء كامل)", color: "bg-emerald-50 text-emerald-800 border-emerald-200", icon: "check_circle" },
  e_visa: { label: "تأشيرة إلكترونية فورية (e-Visa)", color: "bg-blue-50 text-blue-800 border-blue-200", icon: "laptop_chromebook" },
  on_arrival: { label: "تأشيرة عند الوصول للمطار", color: "bg-amber-50 text-amber-800 border-amber-200", icon: "flight_land" },
  eta: { label: "تصريح سفر إلكتروني (ETA)", color: "bg-indigo-50 text-indigo-800 border-indigo-200", icon: "badge" },
  embassy_visa: { label: "تأشيرة سفارة / مركز تأشيرات", color: "bg-purple-50 text-purple-800 border-purple-200", icon: "account_balance" },
};

export function VisaCard({ guide }: { guide: PublicVisaGuideRow }) {
  const typeConfig = VISA_TYPE_LABELS[guide.visa_type] || {
    label: guide.visa_type,
    color: "bg-slate-50 text-slate-800 border-slate-200",
    icon: "info",
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-outline-variant bg-surface shadow-xs transition-all hover:shadow-md">
      {/* Official Verification Header (Core Verified UI) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-100 bg-emerald-50/70 px-5 py-3 text-emerald-900">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xs">
            <Icon name="verified" className="text-base" />
          </span>
          <span className="text-label-md font-bold">مصدر رسمي معتمد وموثق</span>
        </div>

        {guide.last_verified_at && (
          <span className="inline-flex items-center gap-1 text-label-sm text-emerald-800">
            <Icon name="history" className="text-xs" />
            تاريخ التحقق:{" "}
            {new Date(guide.last_verified_at).toLocaleDateString("ar-SA", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </span>
        )}
      </div>

      <div className="p-5 sm:p-6">
        {/* Country & Title */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-title-sm font-semibold text-[#1A2B6D]">
                {guide.destination_country_name_ar}
              </span>
              {guide.destination_country_name_en && (
                <span className="text-label-sm text-on-surface-variant font-medium">
                  ({guide.destination_country_name_en})
                </span>
              )}
            </div>
            <h3 className="mt-1 text-headline-sm font-bold text-on-surface">{guide.title_ar}</h3>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-label-sm font-bold ${typeConfig.color}`}
          >
            <Icon name={typeConfig.icon} className="text-base" />
            {typeConfig.label}
          </span>
        </div>

        <p className="mt-3 text-body-md text-on-surface-variant leading-relaxed">
          {guide.summary_ar}
        </p>

        {/* Quick Specs Grid */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-xl bg-surface-container/60 p-4 border border-outline-variant/60">
          <div>
            <span className="block text-label-xs text-on-surface-variant">وقت المعالجة</span>
            <span className="text-title-sm font-bold text-on-surface">
              {guide.processing_time_days === 0
                ? "فوري / عند الوصول"
                : `${guide.processing_time_days} أيام عمل`}
            </span>
          </div>

          <div>
            <span className="block text-label-xs text-on-surface-variant">مدة الإقامة</span>
            <span className="text-title-sm font-bold text-on-surface">
              {guide.stay_duration_days ? `حتى ${guide.stay_duration_days} يوماً` : "حسب الغرض"}
            </span>
          </div>

          <div>
            <span className="block text-label-xs text-on-surface-variant">الصلاحية</span>
            <span className="text-title-sm font-bold text-on-surface">
              {guide.validity_days ? `${guide.validity_days} يوماً` : "محددة بالتأشيرة"}
            </span>
          </div>

          <div>
            <span className="block text-label-xs text-on-surface-variant">الرسوم الحكومية</span>
            <span className="text-title-sm font-bold text-primary">
              {guide.cost_estimate === 0
                ? "مجانية (0 ريال)"
                : `${guide.cost_estimate} ${guide.currency}`}
            </span>
          </div>
        </div>

        {/* Requirements & Documents */}
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {guide.requirements_ar && guide.requirements_ar.length > 0 && (
            <div className="rounded-xl border border-outline-variant p-4">
              <h4 className="flex items-center gap-1.5 text-title-xs font-bold text-on-surface">
                <Icon name="checklist" className="text-primary text-base" />
                أهم الشروط والمتطلبات:
              </h4>
              <ul className="mt-2.5 space-y-1.5 text-body-sm text-on-surface-variant">
                {guide.requirements_ar.map((req, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1 size-1.5 rounded-full bg-primary shrink-0" />
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {guide.documents_required && guide.documents_required.length > 0 && (
            <div className="rounded-xl border border-outline-variant p-4">
              <h4 className="flex items-center gap-1.5 text-title-xs font-bold text-on-surface">
                <Icon name="description" className="text-secondary text-base" />
                المستندات المطلوبة:
              </h4>
              <ul className="mt-2.5 space-y-1.5 text-body-sm text-on-surface-variant">
                {guide.documents_required.map((doc, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Icon name="check" className="text-emerald-600 text-sm shrink-0 mt-0.5" />
                    <span>{doc}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Official Portal Source Action */}
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-outline-variant/60 pt-4">
          <div>
            <span className="block text-label-xs text-on-surface-variant">الجهة الرسمية المعتمدة:</span>
            <span className="text-label-md font-semibold text-on-surface">
              {guide.official_source_name || "البوابة الحكومية الرسمية"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {guide.official_portal_url && (
              <a
                href={guide.official_portal_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-label-md font-bold text-white shadow-xs hover:bg-emerald-800 transition-colors"
              >
                <Icon name="open_in_new" className="text-sm" />
                بوابة التقديم الرسمية
              </a>
            )}

            <Link
              href={`/offers?destinationCityId=${guide.destination_country_id}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#1A2B6D] px-4 py-2 text-label-md font-bold text-[#1A2B6D] hover:bg-[#1A2B6D]/5 transition-colors"
            >
              <Icon name="travel_explore" className="text-sm" />
              عروض السفر لهذه الوجهة
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
