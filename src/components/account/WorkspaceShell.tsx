"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BriefcaseBusiness,
  ChevronLeft,
  FileText,
  House,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Shield,
  UserRound,
  X,
} from "lucide-react";
import { SilaLogo } from "@/components/brand/SilaLogo";
import { LogoutButton } from "@/components/AccountDock";

export function WorkspaceShell({
  children,
  role,
  displayName,
  travelerWorkspace,
}: {
  children: ReactNode;
  role: string;
  displayName: string;
  travelerWorkspace: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const agent = role === "agent";
  const title = agent
    ? "مساحة الوكيل"
    : role === "admin"
      ? "حساب الإدارة"
      : "رحلاتك وقراراتك";
  const links = [
    { href: "/account", label: "نظرة عامة", icon: LayoutDashboard },
    ...(agent
      ? [
          { href: "/account/profile", label: "الملف المهني", icon: UserRound },
          { href: "/account/offers", label: "العروض", icon: FileText },
          {
            href: "/account/requests",
            label: "طلبات التواصل",
            icon: MessageSquare,
          },
          {
            href: "/account/verification",
            label: "توثيق الوكيل",
            icon: Shield,
          },
          {
            href: "/account/agency",
            label: "مساحة الوكالة",
            icon: BriefcaseBusiness,
          },
        ]
      : travelerWorkspace
        ? [
            {
              href: "/account/travel",
              label: "مساحة السفر",
              icon: BriefcaseBusiness,
            },
          ]
        : []),
    { href: "/account/notifications", label: "الإشعارات", icon: Bell },
    ...(role !== "admin"
      ? [{ href: "/account/security", label: "أمان الحساب", icon: Shield }]
      : []),
  ];
  const active = (href: string) =>
    pathname === href ||
    (href !== "/account" && pathname.startsWith(`${href}/`));

  return (
    <div className="min-h-screen bg-mist sila-cognitive-shell">
      <a
        href="#workspace-content"
        className="sr-only z-[100] rounded-xl bg-deep p-3 text-white focus:not-sr-only focus:absolute"
      >
        انتقل إلى محتوى مساحة العمل
      </a>
      <header className="sticky top-0 z-[80] border-b border-outlinev bg-cloud/95 backdrop-blur">
        <div className="mx-auto flex min-h-20 max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/" aria-label="صلة — الرئيسية" className="shrink-0">
              <SilaLogo variant="arabic" priority className="h-8 w-auto" />
            </Link>
            <span
              className="hidden h-7 w-px bg-outlinev sm:block"
              aria-hidden="true"
            />
            <span className="truncate text-sm font-bold text-deep sm:text-base">
              {title}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="lg:hidden">
              <LogoutButton />
            </div>
            <Link
              href="/offers"
              className="hidden min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate hover:bg-low sm:inline-flex"
            >
              تصفّح صلة
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </Link>
            <button
              type="button"
              aria-label={
                open ? "إغلاق قائمة مساحة العمل" : "فتح قائمة مساحة العمل"
              }
              aria-expanded={open}
              aria-controls="workspace-navigation"
              onClick={() => setOpen(!open)}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-outlinev text-deep lg:hidden"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1440px] lg:grid-cols-[232px_minmax(0,1fr)]">
        <aside
          className={`${open ? "block" : "hidden"} border-b border-outlinev bg-cloud px-4 py-5 lg:sticky lg:top-20 lg:block lg:h-[calc(100dvh-80px)] lg:border-b-0 lg:border-e lg:px-5 lg:py-7`}
        >
          <div className="mb-6 border-b border-outlinev pb-5">
            <p className="sila-eyebrow text-xs font-semibold text-signal">
              {agent ? "حساب وكيل" : "حسابك في صلة"}
            </p>
            <p className="mt-2 break-words text-base font-bold text-deep">
              {displayName}
            </p>
          </div>
          <nav
            id="workspace-navigation"
            aria-label="تنقل مساحة العمل"
            className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1"
          >
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                aria-current={active(href) ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-colors ${active(href) ? "bg-air text-deep ring-1 ring-sky/40" : "text-slate hover:bg-low hover:text-deep"}`}
              >
                <Icon
                  className={`h-[18px] w-[18px] shrink-0 ${active(href) ? "text-signal" : ""}`}
                  aria-hidden="true"
                />
                {label}
              </Link>
            ))}
          </nav>
          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-outlinev pt-5 lg:flex-col lg:items-stretch">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-semibold text-slate hover:bg-low"
            >
              <House className="h-[18px] w-[18px]" aria-hidden="true" />
              الرئيسية
            </Link>
            <div className="hidden lg:block">
              <LogoutButton />
            </div>
          </div>
        </aside>
        <div id="workspace-content" className="min-w-0">
          {children}
          <footer className="mx-5 mb-6 flex flex-wrap items-center justify-between gap-3 border-t border-outlinev pt-5 text-xs text-slate md:mx-8">
            <span>صلة · اعرف خطوتك التالية قبل ما تتحرك</span>
            <div className="flex gap-4">
              <Link href="/trust#privacy" className="hover:underline">
                الخصوصية
              </Link>
              <Link href="/trust#verification" className="hover:underline">
                سياسة التوثيق
              </Link>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
