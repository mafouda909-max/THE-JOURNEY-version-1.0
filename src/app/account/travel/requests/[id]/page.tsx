import { notFound, redirect } from "next/navigation";
import { accountFromCookies } from "@/lib/identity";
import { MarketplaceRequestComparison } from "@/components/market/MarketplaceRequestComparison";

export const dynamic = "force-dynamic";

export default async function TravelerMarketplaceRequestPage({ params }: { params: Promise<{ id: string }> }) {
  if (process.env.MULTI_PROVIDER_REQUESTS_ENABLED !== "true") notFound();
  const account = await accountFromCookies();
  if (!account) redirect("/join?mode=traveler");
  if (account.role !== "traveler") redirect("/account");
  const requestId = Number((await params).id);
  if (!Number.isSafeInteger(requestId) || requestId <= 0) notFound();

  return (
    <div className="min-h-screen bg-canvas">
      <MarketplaceRequestComparison requestId={requestId} />
    </div>
  );
}
