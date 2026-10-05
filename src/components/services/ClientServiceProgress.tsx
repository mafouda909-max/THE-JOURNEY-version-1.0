"use client";
import { useEffect, useState } from "react";
import { serviceStatusLabels, type ServiceStatus } from "@/lib/service-fulfillment-domain";

type Progress = { serviceName: string; status: ServiceStatus; dueAt: string; completedAt: string | null };
export function ClientServiceProgress({ token }: { token: string }) {
  const [services, setServices] = useState<Progress[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    let mounted = true;
    fetch(`/api/quote-deliveries/${encodeURIComponent(token)}/service-progress`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unavailable");
        const data = await response.json() as { services: Progress[] };
        if (mounted) setServices(data.services);
      }).catch(() => { if (mounted) setError(true); });
    return () => { mounted = false; };
  }, [token]);
  if (error) return <p className="mt-5 text-sm text-slate">تعذر تحميل متابعة التنفيذ الآن. تواصل مع المكتب للحصول على أحدث حالة.</p>;
  if (services.length === 0) return null;
  return <section className="mt-6 rounded-2xl border border-outlinev bg-white p-5 sm:p-7" aria-labelledby="client-service-progress-title"><h2 id="client-service-progress-title" className="text-xl font-bold text-inkwell">متابعة تنفيذ الخدمات</h2><p className="mt-2 text-sm text-slate">يراجع المكتب التسليم وفق الاتفاق. قبول عرض السعر وحده لا يؤكد إتمام الخدمة.</p><ul className="mt-4 space-y-3">{services.map((service, index) => <li key={index} className="rounded-xl bg-low p-4"><div className="flex flex-wrap justify-between gap-2"><strong>{service.serviceName}</strong><span className="text-sm font-bold text-deep">{serviceStatusLabels[service.status]}</span></div><p className="mt-2 text-xs text-slate">الموعد المتفق عليه: {new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(service.dueAt))}</p></li>)}</ul></section>;
}
