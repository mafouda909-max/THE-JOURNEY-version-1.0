import { and, eq, gt, isNotNull, or, isNull, sql } from "drizzle-orm";
import { offers, agents } from "@/db/schema";

export function publicOfferFilter() {
  return and(
    eq(offers.status, "published"),
    eq(agents.verificationStatus, "verified"),
    isNotNull(agents.verifiedAt),
    gt(offers.expiresAt, sql`now()`),
    or(isNull(offers.departureDate), gt(offers.departureDate, sql`now()`)),
  );
}
