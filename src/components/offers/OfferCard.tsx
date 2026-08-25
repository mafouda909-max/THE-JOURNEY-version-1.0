import Link from "next/link";
import { Badge, Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { formatDate, formatPrice, isExpiringSoon } from "@/lib/format";
import { TRIP_TYPE_LABELS } from "@/components/search/SearchModule";

export interface OfferListItem {
  id: string;
  title_ar: string;
  trip_type: string;
  origin_city_ar: string;
  destination_city_ar: string;
  route_type: string | null;
  price_amount: string | number;
  currency: string;
  price_type: string;
  price_basis: string;
  valid_until: string;
  agent_id: string;
  agent_display_name: string;
  agent_avg_rating: number | null;
}

/**
 * OfferCard — mobile-first hierarchy (UX_AUDIT fix): price dominant,
 * calm validity (no countdown — ratified c), trust signals inline.
 */
export function OfferCard({ offer }: { offer: OfferListItem }) {
  const expiring = isExpiringSoon(offer.valid_until);

  return (
    <Card hover className="flex h-full flex-col overflow-hidden">
      <Link
        href={`/offers/${offer.id}`}
        className="flex h-full flex-col p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <Badge tone="neutral">{TRIP_TYPE_LABELS[offer.trip_type as keyof typeof TRIP_TYPE_LABELS] ?? offer.trip_type}</Badge>
          {expiring && (
            <Badge tone="warning" icon="schedule">
              ينتهي قريبًا
            </Badge>
          )}
        </div>

        {/* Route line — RTL reading; arrow points left = travel direction */}
        <h3 className="text-title-lg text-on-surface">{offer.title_ar}</h3>
        <p className="mt-1 flex items-center gap-1.5 text-body-md text-on-surface-variant">
          <span>{offer.origin_city_ar}</span>
          <Icon name="arrow_back" className="text-[18px]" />
          <span className="font-semibold text-on-surface">{offer.destination_city_ar}</span>
          {offer.route_type === "transit" && (
            <span className="text-label-md">· بمحطة تحويل</span>
          )}
        </p>

        <div className="mt-auto pt-4">
          <p className="tabular-nums text-headline-md font-bold text-primary">
            <bdi>{formatPrice(offer.price_amount, offer.currency)}</bdi>
          </p>
          <p className="mt-0.5 flex items-center gap-2 text-label-md text-on-surface-variant">
            {offer.price_type === "starting_from" && <span>يبدأ من</span>}
            <span>
              {offer.price_basis === "per_person" ? "للشخص" : offer.price_basis === "per_group" ? "للمجموعة" : "إجمالي"}
            </span>
            {!expiring && (
              <span>
                · حتى <time dateTime={offer.valid_until}>{formatDate(offer.valid_until)}</time>
              </span>
            )}
          </p>

          <div className="mt-3 flex items-center justify-between border-t border-outline-variant pt-3">
            <span className="flex items-center gap-2 text-label-lg text-on-surface-variant">
              <Icon name="verified" filled className="text-[18px] text-success" />
              {offer.agent_display_name}
            </span>
            {offer.agent_avg_rating !== null && offer.agent_avg_rating > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-surface-container px-2 py-0.5 text-label-md text-on-surface">
                <Icon name="star" filled className="text-[14px] text-tertiary" />
                <span dir="ltr">{Number(offer.agent_avg_rating).toFixed(1)}</span>
              </span>
            )}
          </div>
        </div>
      </Link>
    </Card>
  );
}
