"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, Mail, Menu, ShieldCheck, X } from "lucide-react";

export function RouteMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <path
        d="M4 27 C 13 27, 10 13, 19 13 C 24 13, 26 10, 26.4 8.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="26.5" cy="7.5" r="3.6" fill="currentColor" />
    </svg>
  );
}

function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <RouteMark className={`h-7 w-7 ${light ? "text-white" : "text-deep"}`} />
      <span className="leading-none">
        <span
          className={`block text-[22px] font-bold tracking-tight ${
            light ? "text-white" : "text-deep"
          }`}
        >
          الرحلة
        </span>
        <span
          className={`mt-1 block font-mono text-[9px] font-semibold uppercase tracking-[0.32em] ${
            light ? "text-oninverse/50" : "text-slate"
          }`}
        >
          The Journey
        </span>
      </span>
    </span>
  );
}

const links = [
  { href: "/offers", label: "العروض" },
  { href: "/agents", label: "الوكلاء الموثّقون" },
  { href: "/#how", label: "كيف نعمل" },
];

export function Nav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <header className="sticky top-0 z-[80] border-b border-outlinev bg-cloud/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:h-[72px] md:px-8">
          <Link href="/" aria-label="الرحلة — الرئيسية">
            <Wordmark />
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`relative text-[15px] font-medium transition-colors hover:text-deep ${
                  pathname === l.href ? "text-deep" : "text-slate"
                }`}
              >
                {l.label}
                {pathname === l.href && (
                  <span className="absolute -bottom-2 right-0 h-0.5 w-full rounded-full bg-deep" />
                )}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/join"
              className="hidden text-sm font-semibold text-slate transition-colors hover:text-deep md:block"
            >
              دخول
            </Link>
            <Link
              href="/join?mode=agent"
              className="hidden rounded-lg border-2 border-deep px-5 py-2.5 text-sm font-semibold text-deep transition-all duration-300 hover:bg-deep hover:text-white md:block"
            >
              انضم كوكيل
            </Link>
            <button
              onClick={() => setOpen(true)}
              aria-label="فتح القائمة"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-outlinev text-inkwell md:hidden"
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
              {[{ href: "/", label: "الرئيسية" }, ...links, { href: "/trust#agent", label: "انضم كوكيل" }].map(
                (l, i) => (
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
                ),
              )}
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
  return (
    <footer className="border-t border-deep/20 bg-inverse text-oninverse">
      <div className="mx-auto max-w-7xl px-5 py-16 md:px-8">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <Wordmark light />
            <p className="mt-6 max-w-sm leading-relaxed text-oninverse/60">
              سوق ثقة للسفر: المسافر يتواصل مباشرة مع الوكيل، والرحلة تتوسّط
              التوثيق والمراجعة والمتابعة — لا السعر.
            </p>
            <a
              href="mailto:hello@alrihla.travel"
              className="mt-6 inline-flex items-center gap-2 rounded-lg border border-oninverse/25 px-4 py-2.5 text-sm transition-colors hover:border-white hover:text-white"
            >
              <Mail className="h-4 w-4" />
              hello@alrihla.travel
            </a>
          </div>

          <div className="md:col-span-2">
            <h4 className="mb-5 font-mono text-[11px] uppercase tracking-[0.2em] text-oninverse/40">
              المنصّة
            </h4>
            <ul className="space-y-3 text-sm text-oninverse/75">
              <li><Link href="/offers" className="transition-colors hover:text-white">تصفّح العروض</Link></li>
              <li><Link href="/destinations" className="transition-colors hover:text-white">الوجهات</Link></li>
              <li><Link href="/agents" className="transition-colors hover:text-white">الوكلاء الموثّقون</Link></li>
              <li><Link href="/trust#agent" className="transition-colors hover:text-white">انضم كوكيل</Link></li>
              <li><Link href="/review" className="transition-colors hover:text-white">بوابة المراجعة</Link></li>
            </ul>
          </div>

          <div className="md:col-span-2">
            <h4 className="mb-5 font-mono text-[11px] uppercase tracking-[0.2em] text-oninverse/40">
              الثقة والقانون
            </h4>
            <ul className="space-y-3 text-sm text-oninverse/75">
              <li><Link href="/trust#terms" className="transition-colors hover:text-white">شروط الخدمة</Link></li>
              <li><Link href="/trust#privacy" className="transition-colors hover:text-white">سياسة الخصوصية</Link></li>
              <li><Link href="/trust#verification" className="transition-colors hover:text-white">سياسة توثيق الوكلاء</Link></li>
            </ul>
          </div>

          <div className="md:col-span-3">
            <h4 className="mb-5 font-mono text-[11px] uppercase tracking-[0.2em] text-oninverse/40">
              ما نتحقّق منه
            </h4>
            <ul className="space-y-3 text-sm text-oninverse/75">
              <li className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-verified" />
                الهوية الحكومية لكل وكيل
              </li>
              <li className="flex items-center gap-2">
                <BadgeCheck className="h-4 w-4 text-verified" />
                رخصة السياحة للوكالات المرخّصة
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-verified" />
                مراجعة يدوية لكل عرض قبل النشر
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-oninverse/40 md:flex-row md:items-center">
          <span>© 2026 الرحلة — THE JOURNEY</span>
          <span>الأسعار لدى الوكيل · الثقة لدينا</span>
        </div>
      </div>
    </footer>
  );
}
