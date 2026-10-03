import type { Metadata } from "next";
import { SilaPageIntro } from "@/components/brand/SilaPageIntro";
import { TravelReadinessWorkbench } from "@/components/market/TravelReadinessWorkbench";

export const metadata: Metadata = {
  title: "جاهزية السفر",
  description:
    "افحص جاهزية السفر حسب الجنسية والوجهة وصلاحية الجواز مع قائمة إجراءات واضحة.",
};

export default function ReadinessPage() {
  return (
    <main className="mx-auto min-h-[70vh] max-w-7xl px-5 py-10 md:px-8 md:py-14">
      <SilaPageIntro
        eyebrow="Travel Readiness · قرار قبل الحجز"
        title="هل أنت جاهز للسفر فعلًا؟"
        description="صلة تحول شروط السفر إلى Checklist مرتبطة بسياقك: الجواز، التأشيرة، الترانزيت وما يحتاج منك إجراء قبل الالتزام."
      />
      <TravelReadinessWorkbench />
    </main>
  );
}
