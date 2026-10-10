"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mail, Menu, X } from "lucide-react";
import { SilaLogo } from "@/components/brand/SilaLogo";
import { BRAND } from "@/lib/brand";

function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <SilaLogo
      variant={light ? "primary" : "arabic"}
      light={light}
      priority
      className={light ? "h-14 w-auto" : "h-9 w-auto"}
    />
  );
}

const publicLinks = [
  { href: "/readiness", label: "ابدأ رحلتك" },
  { href: "/offers", label: "العروض" },
  { href: "/agents", label: "الوكلاء" },
  { href: "/trust", label: "كيف نتحقق؟" },
];

function activePath(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(href + "/"));
}

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [accountRole, setAccountRole] = useState<string | null>(null);
  const inWorkspace = pathname === "/account" || pathname.startsWith("/account/");

  useEffect(() => {
    if (inWorkspace) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    void fetch("/api/auth/session", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (response.ok && !controller.signal.aborted) {
          setAccountRole(typeof data.role === "string" ? data.role : null);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        clearTimeout(timeout);
      });
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [pathname, inWorkspace]);

  if (inWorkspace) return null;

  const accountLabel =
    accountRole === "agent" ? "مساحة الوكيل" : accountRole ? "رحلاتي" : "تسجيل الدخول";

  return (
    <>
      <header className="sticky top-0 z-[80] border-b border-outlinev bg-cloud/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-[1320px] items-center justify-between gap-6 px-5 md:px-8">
          <Link href="/" aria-label="صلة — الرئيسية" className="shrink-0">
            <Wordmark />
          </Link>

          <nav className="hidden items-center gap-7 md:flex" aria-label="التنقل الرئيسي">
            {publicLinks.map((link) => {
              const active = activePath(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={
                    "relative py-2 text-[13px] font-bold transition-colors " +
                    (active ? "text-deep" : "text-slate hover:text-deep")
                  }
                >
                  {link.label}
                  {active ? (
                    <span className="absolute inset-x-0 -bottom-[21px] h-0.5 bg-signal" />
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="hidden items-center gap-4 md:flex">
            <Link
              href="/join?mode=agent"
              className="text-[12px] font-bold text-earth transition-colors hover:text-deep"
            >
              للوكلاء
            </Link>
            <Link
              href="/account"
              className="quiet-action min-h-[44px] border-s border-outlinev ps-4"
            >
              {accountLabel}
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="فتح القائمة"
            className="grid h-11 w-11 place-items-center rounded-xl border border-outlinev bg-cloud text-deep md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {open ? (
        <div className="fixed inset-0 z-[100] bg-cloud md:hidden">
          <div className="flex h-[72px] items-center justify-between border-b border-outlinev px-5">
            <Wordmark />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="إغلاق القائمة"
              className="grid h-11 w-11 place-items-center rounded-xl border border-outlinev text-deep"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex min-h-[calc(100vh-72px)] flex-col justify-between px-6 pb-8 pt-10">
            <div className="space-y-1">
              {[{ href: "/", label: "الرئيسية" }, ...publicLinks].map((link, index) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="grid grid-cols-[2.5rem_1fr] items-center border-b border-outlinev py-5"
                >
                  <span className="tnum text-[11px] font-bold text-signal">
                    0{index + 1}
                  </span>
                  <span className="text-2xl font-bold tracking-[-0.025em] text-deep">
                    {link.label}
                  </span>
                </Link>
              ))}
            </div>

            <div className="space-y-3">
              <Link
                href="/account"
                onClick={() => setOpen(false)}
                className="focus-action w-full"
              >
                {accountLabel}
              </Link>
              <Link
                href="/join?mode=agent"
                onClick={() => setOpen(false)}
                className="quiet-action justify-center w-full"
              >
                دخول الوكلاء
              </Link>
            </div>
          </nav>
        </div>
      ) : null}
    </>
  );
}

export function Footer() {
  const pathname = usePathname();
  if (pathname === "/account" || pathname.startsWith("/account/")) return null;

  return (
    <footer className="border-t border-outlinev bg-cloud">
      <div className="mx-auto max-w-[1320px] px-5 py-12 md:px-8 md:py-16">
        <div className="grid gap-10 md:grid-cols-[1.3fr_.7fr_.7fr]">
          <div>
            <Wordmark />
            <p className="mt-5 max-w-md text-sm leading-7 text-slate">
              {BRAND.nameAr} تساعدك تعرف قبل ما تختار: ما المعروض، من أين جاءت المعلومة،
              ما نطاق التحقق، وما الذي ما زال يحتاج تأكيدًا.
            </p>
            {BRAND.supportEmail ? (
              <a
                href={`mailto:${BRAND.supportEmail}`}
                className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-deep"
              >
                <Mail className="h-4 w-4" />
                {BRAND.supportEmail}
              </a>
            ) : null}
          </div>

          <div>
            <div className="text-[11px] font-bold text-slate">المسافر</div>
            <div className="mt-4 space-y-3 text-sm font-semibold text-deep">
              <Link className="block" href="/readiness">ابدأ رحلتك</Link>
              <Link className="block" href="/offers">العروض</Link>
              <Link className="block" href="/agents">الوكلاء</Link>
              <Link className="block" href="/account">رحلاتي</Link>
            </div>
          </div>

          <div>
            <div className="text-[11px] font-bold text-slate">الثقة والعمل</div>
            <div className="mt-4 space-y-3 text-sm font-semibold text-deep">
              <Link className="block" href="/trust">كيف نتحقق؟</Link>
              <Link className="block" href="/join?mode=agent">مساحة الوكيل</Link>
              <Link className="block" href="/trust#privacy">الخصوصية</Link>
              <Link className="block" href="/trust#terms">الشروط</Link>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-outlinev pt-5 text-[11px] text-slate md:flex-row md:items-center md:justify-between">
          <span>© 2026 {BRAND.nameAr} · {BRAND.nameEn}</span>
          <span>العرض + المصدر + النطاق + الصلاحية + السياق = قرار أوضح</span>
        </div>
      </div>
    </footer>
  );
}
