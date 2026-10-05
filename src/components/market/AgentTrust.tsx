import { SilaIdentityIcon, SilaReviewIcon } from "@/components/brand/SilaIcons";
import type { PublicAgentTrust } from "@/lib/public-agent";

function formatTrustDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-EG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function AgentTrustChip({
  trust,
  compact = false,
}: {
  trust: PublicAgentTrust;
  compact?: boolean;
}) {
  const identity = trust.claims.find((claim) => claim.kind === "identity");
  const activity = trust.claims.find((claim) => claim.kind === "activity");
  const entity = trust.claims.find((claim) => claim.kind === "entity");

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {identity && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-verifiedbg px-2.5 py-1 text-[11px] font-semibold text-verified">
          <SilaIdentityIcon className="h-3.5 w-3.5" />
          هوية مُراجَعة
        </span>
      )}
      {!compact && activity && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-air px-2.5 py-1 text-[11px] font-semibold text-deep">
          <SilaReviewIcon className="h-3.5 w-3.5" />
          نشاط مهني مُراجع
        </span>
      )}
      {!compact && entity && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-low px-2.5 py-1 text-[11px] font-semibold text-deep">
          <SilaReviewIcon className="h-3.5 w-3.5" />
          كيان مُراجع
        </span>
      )}
    </span>
  );
}

export function AgentTrustPanel({
  trust,
  className = "",
}: {
  trust: PublicAgentTrust;
  className?: string;
}) {
  return (
    <div className={`sila-window border border-sky/40 bg-air/45 p-5 shadow-[inset_4px_0_0_#2E6FD8] ${className}`}>
      <div className="flex items-start gap-3">
        <SilaReviewIcon className="mt-0.5 h-4 w-4 shrink-0 text-signal" />
        <div>
          <div className="font-bold text-deep">ما الذي راجعته صلة عن هذا الوكيل؟</div>
          <div className="mt-1 text-[12px] leading-relaxed text-slate">
            أدلة راجعها فريق الثقة؛ نعرض تاريخ المراجعة والصلاحية عندما تكون مسجلة.
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {trust.claims.map((claim) => (
          <div key={claim.kind} className="rounded-xl border border-outlinev/70 bg-cloud px-3 py-3">
            <div className="text-xs font-bold text-inkwell">{claim.label}</div>
            <div className="mt-1 text-[11px] leading-5 text-slate">{claim.scope}</div>
            <div className="mt-2 text-[10px] leading-5 text-slate">
              راجعناه: {formatTrustDate(claim.verifiedAt)}
              {claim.validUntil ? ` · صالح حتى: ${formatTrustDate(claim.validUntil)}` : " · لا يوجد تاريخ انتهاء مسجل"}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 border-t border-outlinev/70 pt-3 text-[11px] leading-6 text-slate">
        {trust.limitations[0]}
      </p>
    </div>
  );
}
