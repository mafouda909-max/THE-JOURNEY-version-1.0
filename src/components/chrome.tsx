"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Mail, Menu, X } from "lucide-react";
import { SilaIdentityIcon, SilaReviewIcon } from "@/components/brand/SilaIcons";
import { SilaLogo } from "@/components/brand/SilaLogo";
import { BRAND } from "@/lib/brand";

function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <SilaLogo
      variant={light ? "primary" : "arabic"}
      light={light}
      priority
      className={light ? "h-16 w-auto" : "h-9 w-auto"}
    />
  );
}

const communityEnabled = process.env.NEXT_PUBLIC_COMMUNITY_ENABLED === "true";

const links = [
  { href: "/offers", label: "العروض" },
  ...(communityEnabled ? [{ href: "/community", label: "المجتمع" }] : []),
  { href: "/readiness", label: "جاهزية السفر" },
  { href: "/agents", label: "الوكلاء الموثّقون" },
  { href: "/#how", label: "كيف نعمل" },
];

export function Nav() {
  const [open, setOpen] = useState(false);
  const [accountRole, setAccountRole] = useState<string | null>(null);
  const pathname = usePathname();
  const inWorkspace =
    pathname === "/account" || pathname.startsWith("/account/");

  useEffect(() => {
    if (inWorkspace) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    void fetch("/api/auth/session", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        // Fetch resolves at the headers. Consume the response before clearing
        // the deadline, including unsuccessful responses; a streamed body
        // can keep network activity alive after this promise has finished.
        const data = await response.json();
        if (!response.ok) return;
        if (!controller.signal.aborted)
          setAccountRole(
            typeof data.role === "string" ? data.role : null,
          );
      })
      .catch(() => undefined)
      .finally(() => {
        controller.abort();
        clearTimeout(timeout);
      });
    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [pathname, inWorkspace]);

  if (inWorkspace) return null;
  const accountLabel =
    accountRole === "agent" ? "مساحة الوكيل" : accountRole ? "مساحتك" : "حسابك";

  return (
    <>
      <header className="sticky top-0 z-[80] bg-mist/80 px-3 py-2 backdrop-blur-xl md:px-5">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between rounded-2xl border border-outlinev/80 bg-cloud/92 px-4 shadow-[0_8px_30px_rgba(8,38,74,0.06)] md:h-[68px] md:px-6">
          <Link href="/" aria-label="صلة — الرئيسية">
            <Wordmark />
          </Link>

          <nav className="hidden items-center gap-1 rounded-2xl bg-low/70 p-1 md:flex">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`relative rounded-xl px-4 py-2 text-[14px] font-semibold transition-all ${
                  pathname === l.href
                    ? "bg-cloud text-deep shadow-sm"
                    : "text-slate hover:bg-cloud/70 hover:text-deep"
                }`}
              >
                {l.label}
                {pathname === l.href && (
                  <span className="absolute bottom-1 start-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-signal" />
                )}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/account"
              className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-slate transition-colors hover:bg-low hover:text-deep md:block"
            >
              {accountLabel}
            </Link>
            {!accountRole && (
              <Link
                href="/join?mode=agent"
                className="sila-motion-safe hidden rounded-xl bg-deep px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-horizon hover:shadow-md md:block"
              >
                سجّل كوكيل
              </Link>
            )}
            <button
              onClick={() => setOpen(true)}
              aria-label="فتح القائمة"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-outlinev bg-cloud text-inkwell md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[100] flex flex-col bg-cloud"
          >
            <div className="flex h-16 items-center justify-between border-b border-outlinev px-5">
              <Wordmark />
              <button
                onClick={() => setOpen(false)}
                aria-label="إغلاق القائمة"
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-outlinev"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-1 flex-col justify-center gap-8 px-8">
              {[
                { href: "/", label: "الرئيسية" },
                ...links,
                { href: "/account", label: accountLabel },
                ...(!accountRole
                  ? [{ href: "/join?mode=agent", label: "سجّل كوكيل" }]
                  : []),
              ].map((l, i) => (
                <motion.div
                  key={l.href + l.label}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 + i * 0.05 }}
                >
                  <Link
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="text-4xl font-bold text-deep"
                  >
                    {l.label}
                  </Link>
                </motion.div>
              ))}
            </nav>
            <div className="px-8 pb-10 text-sm text-slate">
              منصّة الوكلاء الموثّقين — الأسعار لدى الوكيل، والثقة لدينا.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function Footer() {
  const pathname = usePathname();
  if (pathname === "/account" || pathname.startsWith("/account/")) return null;
  return (
    <footer className="relative overflow-hidden border-t border-deep/20 bg-inverse text-oninverse">
      <div
        aria-hidden
        className="absolute start-0 top-0 flex w-full items-center gap-3 px-6 pt-5 opacity-35"
      >
        <span className="h-2.5 w-2.5 rounded-full bg-signal" />
        <span className="h-2.5 w-2.5 rounded-full bg-sky" />
        <span className="h-px flex-1 bg-air/30" />
      </div>
      <div className="relative mx-auto max-w-7xl px-5 pb-16 pt-20 md:px-8">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <Wordmark light />
            <p className="mt-6 max-w-sm leading-relaxed text-oninverse/60">
              {BRAND.nameAr} تربط المسافر بالوكيل الموثوق وتضع مصدر المعلومة
              ونطاق المراجعة أمامه قبل القرار — من دون أن تتوسّط في السعر.
            </p>
            {BRAND.supportEmail ? (
              <a
                href={`mailto:${BRAND.supportEmail}`}
                className="mt-6 inline-flex items-center gap-2 rounded-lg border border-oninverse/25 px-4 py-2.5 text-sm transition-colors hover:border-white hover:text-white"
              >
                <Mail className="h-4 w-4" />
                {BRAND.supportEmail}
              </a>
            ) : null}
          </div>

          <div className="md:col-span-2">
            <h4 className="mb-5 font-mono text-[11px] uppercase tracking-[0.2em] text-oninverse/40">
              المنصّة
            </h4>
            <ul className="space-y-3 text-sm text-oninverse/75">
              <li>
                <Link
                  href="/offers"
                  className="transition-colors hover:text-white"
                >
                  تصفّح العروض
                </Link>
              </li>
              <li>
                <Link
                  href="/compare"
                  className="transition-colors hover:text-white"
                >
                  قارن الرحلات
                </Link>
              </li>
              <li>
                <Link
                  href="/readiness"
                  className="transition-colors hover:text-white"
                >
                  جاهزية السفر
                </Link>
              </li>
              <li>
                <Link
                  href="/destinations"
                  className="transition-colors hover:text-white"
                >
                  الوجهات
                </Link>
              </li>
              {communityEnabled ? (
                <li>
                  <Link
                    href="/community"
                    className="transition-colors hover:text-white"
                  >
                    المجتمع
                  </Link>
                </li>
              ) : null}
              <li>
                <Link
                  href="/agents"
                  className="transition-colors hover:text-white"
                >
                  الوكلاء الموثّقون
                </Link>
              </li>
              <li>
                <Link
                  href="/join?mode=agent"
                  className="transition-colors hover:text-white"
                >
                  سجّل كوكيل
                </Link>
              </li>
              <li>
                <Link
                  href="/review"
                  className="transition-colors hover:text-white"
                >
                  بوابة المراجعة
                </Link>
              </li>
            </ul>
          </div>

          <div className="md:col-span-2">
            <h4 className="mb-5 font-mono text-[11px] uppercase tracking-[0.2em] text-oninverse/40">
              الثقة والقانون
            </h4>
            <ul className="space-y-3 text-sm text-oninverse/75">
              <li>
                <Link
                  href="/trust#terms"
                  className="transition-colors hover:text-white"
                >
                  شروط الخدمة
                </Link>
              </li>
              <li>
                <Link
                  href="/trust#privacy"
                  className="transition-colors hover:text-white"
                >
                  سياسة الخصوصية
                </Link>
              </li>
              <li>
                <Link
                  href="/trust#verification"
                  className="transition-colors hover:text-white"
                >
                  سياسة توثيق الوكلاء
                </Link>
              </li>
            </ul>
          </div>

          <div className="md:col-span-3">
            <h4 className="mb-5 font-mono text-[11px] uppercase tracking-[0.2em] text-oninverse/40">
              ما نتحقّق منه
            </h4>
            <ul className="space-y-3 text-sm text-oninverse/75">
              <li className="flex items-center gap-2">
                <SilaIdentityIcon className="h-4 w-4 text-verified" />
                الهوية الحكومية لكل وكيل
              </li>
              <li className="flex items-center gap-2">
                <SilaReviewIcon className="h-4 w-4 text-verified" />
                رخصة السياحة للوكالات المرخّصة
              </li>
              <li className="flex items-center gap-2">
                <SilaReviewIcon className="h-4 w-4 text-verified" />
                مراجعة يدوية لكل عرض قبل النشر
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-oninverse/40 md:flex-row md:items-center">
          <span>{`© 2026 ${BRAND.nameAr} — ${BRAND.nameEn}`}</span>
          <span>{BRAND.promiseAr}</span>
        </div>
      </div>
    </footer>
  );
}
