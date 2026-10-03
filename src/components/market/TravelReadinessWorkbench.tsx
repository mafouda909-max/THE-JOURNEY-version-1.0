"use client";

import { FormEvent, useState } from "react";
import { Loader2 } from "lucide-react";
import { SilaReviewIcon } from "@/components/brand/SilaIcons";

type Result = {
  status: "READY" | "NEEDS_ATTENTION" | "BLOCKED" | "UNKNOWN";
  overallScore: number;
  checklist: Array<{
    id: string;
    title: string;
    category: string;
    isMandatory: boolean;
    status: "VERIFIED" | "PENDING_ACTION" | "BLOCKED";
    description: string;
  }>;
  warnings: string[];
  missingInformation: string[];
  evaluatedAt: string;
  disclosure: string;
};

const STATUS = {
  READY: ["جاهز مبدئيًا", "bg-verifiedbg text-verified"],
  NEEDS_ATTENTION: ["يحتاج انتباه", "bg-amber text-gold"],
  BLOCKED: ["يوجد مانع", "bg-errorbg text-error"],
  UNKNOWN: ["يحتاج تحقق", "bg-low text-slate"],
} as const;

export function TravelReadinessWorkbench({
  initial,
}: {
  initial?: { destination?: string | null; intentLabel?: string | null };
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/travel/readiness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nationality: data.get("nationality"),
          destination: data.get("destination"),
          passportValidityMonths: Number(data.get("passportValidityMonths")),
          transitCountry: data.get("transitCountry"),
        }),
      });
      const json = (await response.json()) as Result & { error?: string };
      if (!response.ok) throw new Error(json.error ?? "تعذر فحص الجاهزية");
      setResult(json);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "تعذر فحص الجاهزية");
    } finally {
      setLoading(false);
    }
  }

  const field =
    "w-full rounded-2xl border border-outlinev bg-low/60 px-4 py-3.5 text-sm font-semibold text-inkwell outline-none transition-all focus:border-signal focus:bg-cloud focus:ring-4 focus:ring-signal/10";

  return (
    <div className="space-y-4">
      {initial?.intentLabel ? (
        <div className="sila-window border border-sky/40 bg-air/45 px-4 py-3 text-[12px] font-semibold text-deep">
          فحص الجاهزية مرتبط بنية السفر: {initial.intentLabel}. أكمل فقط البيانات الشخصية التي لا نفترضها عنك.
        </div>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[.78fr_1.22fr]">
      <form
        onSubmit={submit}
        className="sila-window h-fit border border-outlinev bg-cloud p-5 shadow-[0_12px_38px_rgba(8,38,74,0.05)] lg:sticky lg:top-28"
      >
        <div className="sila-eyebrow text-[11px] font-semibold text-signal">
          بيانات كفاية لقرار آمن
        </div>
        <h2 className="mt-2 text-xl font-bold text-inkwell">افحص جاهزيتك.</h2>
        <p className="mt-2 text-[12px] leading-6 text-slate">
          لا نفترض جنسيتك أو صلاحية جوازك. أدخل المعلومات التي تغيّر شروط السفر فقط.
        </p>

        <div className="mt-5 space-y-3">
          <input name="nationality" required placeholder="الجنسية" className={field} />
          <input name="destination" required defaultValue={initial?.destination ?? ""} placeholder="وجهة السفر" className={field} />
          <input
            name="passportValidityMonths"
            type="number"
            required
            min={0}
            max={120}
            placeholder="صلاحية الجواز المتبقية بالأشهر"
            className={field}
          />
          <input
            name="transitCountry"
            placeholder="دولة الترانزيت إن وجدت"
            className={field}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="sila-interactive mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-signal px-5 py-3 text-sm font-bold text-white hover:-translate-y-0.5 hover:bg-horizon disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SilaReviewIcon className="h-4 w-4" />}
          {loading ? "نفحص المصادر…" : "افحص الجاهزية"}
        </button>

        {error ? (
          <div className="mt-4 rounded-xl bg-errorbg px-4 py-3 text-[12px] font-semibold text-error">
            {error}
          </div>
        ) : null}
      </form>

      <section>
        {!result ? (
          <div className="sila-window flex min-h-[360px] items-center justify-center border border-dashed border-outlinev bg-cloud p-8 text-center">
            <div className="max-w-lg">
              <SilaReviewIcon className="mx-auto h-9 w-9 text-signal" />
              <h2 className="mt-4 text-xl font-bold text-inkwell">الـChecklist تتكوّن من سياقك أنت.</h2>
              <p className="mt-2 text-sm leading-7 text-slate">
                النتيجة تميّز بين ما تم التحقق منه، وما يحتاج إجراء، وما لا نملك عنه معلومات كافية.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="sila-window border border-outlinev bg-cloud p-6 shadow-[0_12px_38px_rgba(8,38,74,0.05)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-semibold text-slate">حالة الجاهزية</div>
                  <div className="mt-2 text-3xl font-bold text-inkwell">
                    {STATUS[result.status][0]}
                  </div>
                </div>
                <div className="text-end">
                  <div className="tnum text-4xl font-bold text-deep">{result.overallScore}%</div>
                  <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-[11px] font-bold ${STATUS[result.status][1]}`}>
                    {result.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {result.checklist.map((item) => {
                const tone =
                  item.status === "VERIFIED"
                    ? "border-verified/20 bg-verifiedbg/40"
                    : item.status === "BLOCKED"
                      ? "border-error/20 bg-errorbg/50"
                      : "border-gold/20 bg-amber/50";
                return (
                  <article key={item.id} className={`sila-window border p-5 ${tone}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-semibold text-slate">{item.category}</div>
                        <h3 className="mt-1 font-bold text-inkwell">{item.title}</h3>
                      </div>
                      <span className="rounded-full bg-cloud/80 px-2.5 py-1 text-[10px] font-bold text-slate">
                        {item.isMandatory ? "إلزامي" : "للمراجعة"}
                      </span>
                    </div>
                    <p className="mt-2 text-[12px] leading-6 text-slate">{item.description}</p>
                  </article>
                );
              })}
            </div>

            {result.warnings.length > 0 ? (
              <div className="sila-window border border-gold/20 bg-amber/40 p-5">
                <div className="font-bold text-gold">تنبيهات تحتاج مراجعة</div>
                <ul className="mt-2 space-y-2 text-[12px] leading-6 text-slate">
                  {result.warnings.map((warning) => <li key={warning}>• {warning}</li>)}
                </ul>
              </div>
            ) : null}

            <p className="rounded-2xl bg-low px-4 py-3 text-[11px] leading-5 text-slate">
              {result.disclosure}
            </p>
          </div>
        )}
      </section>
      </div>
    </div>
  );
}
