import type { ReactNode } from "react";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function SilaSurface({
  children,
  className,
  tone = "cloud",
  density = "comfortable",
}: {
  children: ReactNode;
  className?: string;
  tone?: "cloud" | "paper" | "air" | "dark";
  density?: "compact" | "comfortable";
}) {
  const tones = {
    cloud: "border-outlinev bg-cloud text-inkwell",
    paper: "border-outlinev bg-mist text-inkwell",
    air: "border-sky/40 bg-air/60 text-inkwell",
    dark: "border-white/10 bg-deep text-white",
  };

  return (
    <div
      className={cx(
        "sila-window border",
        density === "comfortable" ? "p-5 md:p-6" : "p-4",
        tones[tone],
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SilaStatus({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "verified" | "info" | "warning" | "error" | "neutral";
  className?: string;
}) {
  const tones = {
    verified: "bg-verifiedbg text-verified",
    info: "bg-air text-deep",
    warning: "bg-amber text-gold",
    error: "bg-errorbg text-error",
    neutral: "bg-low text-slate",
  };

  return (
    <span
      className={cx(
        "inline-flex min-h-7 items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SilaMetric({
  value,
  label,
  className,
}: {
  value: ReactNode;
  label: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("min-w-0", className)}>
      <div className="tnum text-xl font-bold tracking-tight text-deep md:text-2xl">
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-5 text-slate">{label}</div>
    </div>
  );
}

export function SilaRelationRail({
  label,
  className,
  light = false,
}: {
  label?: ReactNode;
  className?: string;
  light?: boolean;
}) {
  return (
    <div
      className={cx(
        "flex items-center gap-2",
        light ? "text-white/65" : "text-slate",
        className,
      )}
      aria-hidden={label ? undefined : true}
    >
      <span className={cx("h-2.5 w-2.5 rounded-full", light ? "bg-sky" : "bg-signal")} />
      <span className={cx("h-2.5 w-2.5 rounded-full", light ? "bg-air" : "bg-sky")} />
      <span className={cx("h-px min-w-8 flex-1", light ? "bg-white/15" : "bg-outlinev")} />
      {label ? <span className="text-[11px] font-semibold">{label}</span> : null}
    </div>
  );
}


export function SilaDecisionField({
  className,
}: {
  className?: string;
}) {
  const stops = [
    {
      step: "01",
      title: "اللي تعرفه",
      text: "ابدأ بالمعلومة الموجودة فعلًا.",
      position: "sila-decision-stop--start",
    },
    {
      step: "02",
      title: "اللي يحتاج تأكيد",
      text: "نفرّق بين الدليل والافتراض.",
      position: "sila-decision-stop--middle",
    },
    {
      step: "03",
      title: "خطوتك التالية",
      text: "قرار واحد واضح بدل زحمة اختيارات.",
      position: "sila-decision-stop--end",
    },
  ];

  return (
    <div
      className={cx("sila-decision-field", className)}
      role="img"
      aria-label="صلة تربط ما تعرفه بما يحتاج تأكيدًا ثم توضح الخطوة التالية"
    >
      <div className="sila-decision-field__topline">
        <span>صلة القرار</span>
        <SilaRelationRail light className="w-32" />
      </div>

      <svg
        className="sila-decision-field__path"
        viewBox="0 0 520 380"
        aria-hidden="true"
        preserveAspectRatio="none"
      >
        <path d="M468 68 C402 92 374 138 322 174 C258 218 214 210 168 258 C133 294 102 315 62 326" />
        <circle cx="468" cy="68" r="7" />
        <circle cx="322" cy="174" r="7" />
        <circle cx="62" cy="326" r="7" />
      </svg>

      {stops.map((stop) => (
        <div key={stop.step} className={cx("sila-decision-stop", stop.position)}>
          <div className="sila-decision-stop__number tnum">{stop.step}</div>
          <div className="sila-decision-stop__copy">
            <strong>{stop.title}</strong>
            <span>{stop.text}</span>
          </div>
        </div>
      ))}

      <div className="sila-decision-field__caption">
        <span className="sila-decision-field__pulse" aria-hidden="true" />
        الواجهة لا تعرض كل الطريق مرة واحدة؛ تعرض الجزء الذي تحتاجه الآن.
      </div>
    </div>
  );
}
