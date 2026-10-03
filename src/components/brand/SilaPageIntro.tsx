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
    <header className="relative mb-10 overflow-hidden rounded-[2rem] border border-outlinev bg-cloud px-6 py-8 shadow-[0_12px_36px_rgba(8,38,74,0.05)] md:px-9 md:py-10">
      <div aria-hidden className="absolute inset-y-0 start-0 w-1.5 bg-signal" />
      <SilaRelationRail className="absolute end-7 top-7 w-28 opacity-70" />

      <div className="max-w-3xl">
        <div className="sila-eyebrow text-[12px] font-semibold text-signal">{eyebrow}</div>
        <h1 className="mt-4 text-4xl font-bold leading-tight tracking-[-0.035em] text-inkwell md:text-6xl">
          {title}
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-7 text-slate md:text-base">
          {description}
        </p>
        {meta ? <div className="mt-6">{meta}</div> : null}
      </div>
    </header>
  );
}
