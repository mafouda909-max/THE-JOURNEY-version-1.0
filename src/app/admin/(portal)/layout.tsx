import Link from "next/link";
import type { ReactNode } from "react";
import { requireAdminMfa } from "@/lib/auth/guards";
import { signOutAction } from "@/lib/auth/actions";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin/dashboard", label: "لوحة الإدارة" },
  { href: "/admin/offers", label: "مراجعة العروض" },
  { href: "/admin/agents", label: "الوكلاء والتوثيق" },
] as const;

/** ADMIN PORTAL SHELL — requireAdminMfa() refuses non-AAL2 sessions (AD-14). */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { user } = await requireAdminMfa();

  return (
    <div className="min-h-dvh bg-surface-container-lowest">
      <header className="sticky top-0 z-40 border-b border-outline-variant bg-surface">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <span className="rounded-md bg-inverse-surface px-2 py-0.5 text-label-lg text-inverse-on-surface">
              ADMIN
            </span>
            <span className="text-title-md text-on-surface">بوابة إدارة الرحلة</span>
          </div>
          <form action={signOutAction}>
            <button type="submit" className="text-label-lg text-on-surface-variant hover:text-on-surface">
              خروج ({user.email?.split("@")[0]})
            </button>
          </form>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 px-4 pb-2 md:px-6" aria-label="قائمة الإدارة">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-full px-3 py-1.5 text-label-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">{children}</main>
    </div>
  );
}
