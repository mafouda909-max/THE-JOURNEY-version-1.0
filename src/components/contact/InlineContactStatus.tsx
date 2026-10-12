import Link from "next/link";
import { Badge, Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { cancelContactRequestAction, closeContactRequestAction } from "@/lib/contact/actions";
import { CONTACT_STATUS_AR, contactStatusTone } from "@/lib/contact/labels";

export interface ActiveContactRequest {
  id: string;
  status: "new" | "viewed" | "responded";
  created_at: string;
  responded_at: string | null;
  response_message: string | null;
}

const STEPS = ["new", "viewed", "responded"] as const;

/**
 * INLINE CONTACT STATUS — SPEC §4.6: the traveler tracks the request lifecycle
 * in place (never a separate page). Traveler-only transitions: CANCEL while
 * new/viewed, CLOSE after responded (§2.8; agents can never do either).
 */
export function InlineContactStatus({
  request,
  offerId,
}: {
  request: ActiveContactRequest;
  offerId: string;
}) {
  const stepIndex = STEPS.indexOf(request.status as (typeof STEPS)[number]);
  const label = CONTACT_STATUS_AR[request.status] ?? request.status;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-title-md text-on-surface">طلب التواصل</h3>
        <Badge tone={contactStatusTone(request.status)}>{label}</Badge>
      </div>

      {/* Lifecycle tracker */}
      <ol className="mt-3 flex items-center gap-1" aria-label="مراحل الطلب">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-1">
            <span
              aria-current={i === stepIndex ? "step" : undefined}
              className={
                "flex size-6 shrink-0 items-center justify-center rounded-full text-label-md " +
                (i <= stepIndex ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant")
              }
            >
              {i < stepIndex ? <Icon name="check" className="text-[14px]" /> : i + 1}
            </span>
            {i < STEPS.length - 1 && (
              <span aria-hidden className={"h-0.5 flex-1 " + (i < stepIndex ? "bg-primary" : "bg-surface-container")} />
            )}
          </li>
        ))}
      </ol>
      <p className="mt-1.5 text-label-md text-on-surface-variant">
        {CONTACT_STATUS_AR.new} ← {CONTACT_STATUS_AR.viewed} ← {CONTACT_STATUS_AR.responded}
      </p>

      {request.response_message && (
        <div className="mt-3 rounded-md bg-primary-container px-3 py-2">
          <p className="text-label-md text-on-primary-container">رد الوكيل:</p>
          <p className="mt-1 whitespace-pre-line text-body-sm text-on-primary-container">
            {request.response_message}
          </p>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <Link href="/profile" className="text-label-md text-primary hover:underline">
          كل طلباتي
        </Link>
        {(request.status === "new" || request.status === "viewed") && (
          <form action={cancelContactRequestAction}>
            <input type="hidden" name="request_id" value={request.id} />
            <input type="hidden" name="offer_id" value={offerId} />
            <Button type="submit" variant="ghost" size="sm">
              إلغاء الطلب
            </Button>
          </form>
        )}
        {request.status === "responded" && (
          <form action={closeContactRequestAction}>
            <input type="hidden" name="request_id" value={request.id} />
            <input type="hidden" name="offer_id" value={offerId} />
            <Button type="submit" variant="secondary" size="sm">
              إنهاء الطلب وشكرًا
            </Button>
          </form>
        )}
      </div>
    </Card>
  );
}
