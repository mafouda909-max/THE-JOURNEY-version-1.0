import Link from "next/link";
import type { ReactNode } from "react";
import { requireAgent } from "@/lib/auth/guards";
import { signOutAction } from "@/lib/auth/actions";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/dashboard", label: "الرئيسية" },
  { href: "/dashboard/offers", label: "عروضي" },
  { href: "/dashboard/contacts", label: "طلبات التواصل" },
  { href: "/dashboard/profile", label: "ملفي" },
  { href: "/dashboard/verification", label: "التوثيق" },
] as const;

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { user } = await requireAgent();

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-outline-variant bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6 lg:px-10">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span aria-hidden className="size-7 rounded-full bg-primary" />
            <span className="text-title-lg font-bold text-on-surface">الرحلة</span>
            <span className="rounded-full bg-surface-container px-2 py-0.5 text-label-md text-on-surface-variant">
              بوابة الوكيل
            </span>
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-full px-3 py-1.5 text-label-lg text-on-surface-variant hover:bg-surface-container"
            >
              خروج ({user.email?.split("@")[0]})
            </button>
          </form>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2 md:px-6 lg:px-10" aria-label="قائمة الوكيل">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="whitespace-nowrap rounded-full px-3 py-1.5 text-label-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
            >
              {n.label}
            </Link>
          ))}
          <Link
            href="/dashboard/offers/new"
            className="ms-auto whitespace-nowrap rounded-full bg-primary px-3 py-1.5 text-label-lg text-on-primary"
          >
            + عرض جديد
          </Link>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
