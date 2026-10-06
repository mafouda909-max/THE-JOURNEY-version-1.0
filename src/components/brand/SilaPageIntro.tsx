import { SilaRelationRail } from "@/components/brand/SilaPrimitives";

export function SilaPageIntro({
  eyebrow,
  title,
  description,
  meta,
}: {
  eyebrow: string;
  title: string;
  description: string;
  meta?: React.ReactNode;
}) {
  return (
    <header className="sila-brand-intro relative mb-12 overflow-hidden pb-10 pt-3 md:pb-14 md:pt-5">
      <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_220px] md:items-start">
        <div className="max-w-4xl">
          <div className="sila-eyebrow text-[12px] font-semibold text-signal">{eyebrow}</div>
          <h1 className="mt-5 text-[clamp(2.7rem,6vw,5.2rem)] font-bold leading-[1.02] tracking-[-0.04em] text-inkwell">
            {title}
          </h1>
          <p className="mt-5 max-w-[44rem] text-[15px] leading-8 text-slate md:text-[17px]">
            {description}
          </p>
          {meta ? <div className="mt-7">{meta}</div> : null}
        </div>

        <div className="hidden pt-3 md:block">
          <div className="text-[10px] font-semibold text-slate">من طرف لطرف</div>
          <SilaRelationRail className="mt-3 w-full" />
          <p className="mt-4 text-[11px] leading-6 text-slate">
            المسافر، المعلومة، والوكيل يفضلوا في نفس السياق بدل ما يتفصلوا في شاشات متباعدة.
          </p>
        </div>
      </div>
    </header>
  );
}
