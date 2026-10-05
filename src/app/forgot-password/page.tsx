import type { Metadata } from "next";
import { RecoveryRequestForm } from "@/components/RecoveryRequestForm";
import { passwordAuthReadiness } from "@/lib/password-auth";
import { recoveryMailReady } from "@/lib/password-recovery";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "استعادة الحساب", robots: { index: false }, referrer: "no-referrer" };

export default async function ForgotPasswordPage() {
  const [authReady, mailReady] = await Promise.all([
    passwordAuthReadiness.probe().catch(() => false),
    recoveryMailReady().catch(() => false),
  ]);
  return <RecoveryRequestForm mailReady={authReady && mailReady} />;
}
