import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { accountFromCookies } from "@/lib/identity";
import { servicePilotWorkspaceIds } from "@/lib/service-fulfillment-domain";
import { ServiceFulfillmentPanel } from "@/components/services/ServiceFulfillmentPanel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "مهام الشريك | صلة", robots: { index: false, follow: false } };
export default async function PartnerPage() {
  const account = await accountFromCookies();
  if (!account) redirect("/join");
  if (servicePilotWorkspaceIds().length === 0) notFound();
  return <main className="mx-auto max-w-5xl px-4 pb-20 pt-8 sm:px-6"><Link href="/account" className="text-sm font-bold text-deep">العودة للحساب</Link><ServiceFulfillmentPanel audience="partner" /></main>;
}
