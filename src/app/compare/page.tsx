import type { Metadata } from "next";
import { SilaPageIntro } from "@/components/brand/SilaPageIntro";
import { FlightCompareWorkbench } from "@/components/market/FlightCompareWorkbench";

export const metadata: Metadata = {
  title: "قارن الرحلات",
  description:
    "قارن نتائج الرحلات من مصادر الموردين المتصلة مع مصدر وتوقيت واضحين قبل الالتزام.",
};

export default function ComparePage() {
  return (
    <main className="mx-auto min-h-[70vh] max-w-7xl px-5 py-10 md:px-8 md:py-14">
      <SilaPageIntro
        eyebrow="Travel Intelligence · مصادر حية"
        title="قارن المعلومة، مش السعر وحده."
        description="صلة توحّد نتائج الموردين في نموذج واحد وتوضح المصدر ووقت التحقق والمدة والتوقفات والأمتعة. النتيجة تساعد القرار؛ ولا تخفي حدود المصدر."
        meta={
          <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
            <span className="rounded-full bg-air px-3 py-1.5 text-deep">GDS / NDC ready</span>
            <span className="rounded-full bg-low px-3 py-1.5 text-slate">مصدر + وقت تحقق</span>
            <span className="rounded-full bg-low px-3 py-1.5 text-slate">لا نتائج وهمية</span>
          </div>
        }
      />
      <FlightCompareWorkbench />
    </main>
  );
}
