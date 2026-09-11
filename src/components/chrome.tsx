"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BadgeCheck, Mail, Menu, ShieldCheck, X } from "lucide-react";
import { BrandLockup } from "@/components/brand";

const links = [
  { href: "/offers", label: "العروض" },
  { href: "/agents", label: "الوكلاء الموثّقون" },
  { href: "/#how", label: "كيف نعمل" },
];

export function Nav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab") return;

      const dialog = document.getElementById("mobile-nav");
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("disabled"));
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    queueMicrotask(() => closeButtonRef.current?.focus());
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      menuButtonRef.current?.focus();
    };
  }, [open]);

  const closeMenu = () => setOpen(false);

  return (
    <>
      <header className="sticky top-0 z-[80] border-b border-outlinev/90 bg-cloud/92 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:h-[72px] md:px-8">
          <Link href="/" aria-label="الرحلة — الرئيسية" className="rounded-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-deep/20">
            <BrandLockup />
          </Link>
          <nav className="hidden items-center gap-8 md:flex" aria-label="التنقل الرئيسي">
            {links.map((link) => {
              const active = link.href !== "/#how" && pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative rounded-sm text-[15px] font-medium transition-colors hover:text-deep focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-deep/20 ${active ? "text-deep" : "text-slate"}`}
                >
                  {link.label}
                  {active && <span className="absolute -bottom-2 right-0 h-0.5 w-full rounded-full bg-deep" aria-hidden />}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/join" className="hidden rounded-md px-2 py-2 text-sm font-semibold text-slate transition-colors hover:text-deep focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-deep/20 md:block">دخول</Link>
            <Link href="/join?mode=agent" className="hidden rounded-lg border-2 border-deep px-5 py-2.5 text-sm font-semibold text-deep transition-colors hover:bg-deep hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-deep/20 md:block">انضم كوكيل</Link>
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setOpen(true)}
              aria-label="فتح القائمة"
              aria-expanded={open}
              aria-controls="mobile-nav"
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-outlinev text-inkwell focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-deep/20 md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-nav"
            role="dialog"
            aria-modal="true"
            aria-label="قائمة التنقل"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.18 }}
            className="fixed inset-0 z-[100] flex flex-col bg-cloud"
          >
            <div className="flex h-16 items-center justify-between border-b border-outlinev px-5">
              <Link href="/" onClick={closeMenu} aria-label="الرحلة — الرئيسية"><BrandLockup /></Link>
              <button ref={closeButtonRef} type="button" onClick={closeMenu} aria-label="إغلاق القائمة" className="flex h-11 w-11 items-center justify-center rounded-lg border border-outlinev focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-deep/20">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-1 flex-col justify-center gap-7 px-8" aria-label="التنقل على الهاتف">
              {[{ href: "/", label: "الرئيسية" }, ...links, { href: "/join?mode=agent", label: "انضم كوكيل" }].map((link, index) => (
                <motion.div
                  key={link.href + link.label}
                  initial={reduceMotion ? false : { opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: reduceMotion ? 0 : 0.03 + index * 0.035 }}
                >
                  <Link href={link.href} onClick={closeMenu} className="rounded-md text-4xl font-bold text-deep focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-deep/20">{link.label}</Link>
                </motion.div>
              ))}
            </nav>
            <div className="px-8 pb-10 text-sm leading-relaxed text-slate">سوق ثقة للسفر — نوضح ما نعرفه، ومصدره، وما يزال يحتاج تحققًا.</div>
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
            <BrandLockup inverse />
            <p className="mt-6 max-w-sm leading-relaxed text-oninverse/66">سوق ثقة للسفر ونظام تشغيل للوكالات: نربط الطلب الحقيقي بفرصة قابلة للتسعير والمتابعة، مع إبقاء الدليل والصلاحية بجانب كل معلومة متغيرة.</p>
            <a href="mailto:hello@alrihla.travel" className="mt-6 inline-flex items-center gap-2 rounded-lg border border-oninverse/25 px-4 py-2.5 text-sm transition-colors hover:border-white hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/25">
              <Mail className="h-4 w-4" />
              hello@alrihla.travel
            </a>
          </div>
          <div className="md:col-span-2">
            <h4 className="mb-5 font-mono text-[11px] uppercase tracking-[0.2em] text-oninverse/45">المنصّة</h4>
            <ul className="space-y-3 text-sm text-oninverse/75">
              <li><Link href="/offers" className="transition-colors hover:text-white">تصفّح العروض</Link></li>
              <li><Link href="/destinations" className="transition-colors hover:text-white">الوجهات</Link></li>
              <li><Link href="/agents" className="transition-colors hover:text-white">الوكلاء الموثّقون</Link></li>
              <li><Link href="/join?mode=agent" className="transition-colors hover:text-white">انضم كوكيل</Link></li>
            </ul>
          </div>
          <div className="md:col-span-2">
            <h4 className="mb-5 font-mono text-[11px] uppercase tracking-[0.2em] text-oninverse/45">الثقة والقانون</h4>
            <ul className="space-y-3 text-sm text-oninverse/75">
              <li><Link href="/trust#terms" className="transition-colors hover:text-white">شروط الخدمة</Link></li>
              <li><Link href="/trust#privacy" className="transition-colors hover:text-white">سياسة الخصوصية</Link></li>
              <li><Link href="/trust#verification" className="transition-colors hover:text-white">سياسة توثيق الوكلاء</Link></li>
            </ul>
          </div>
          <div className="md:col-span-3">
            <h4 className="mb-5 font-mono text-[11px] uppercase tracking-[0.2em] text-oninverse/45">لغة الثقة</h4>
            <ul className="space-y-3 text-sm text-oninverse/75">
              <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-verifiedbright" />موثّق: دليل راجعناه</li>
              <li className="flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-verifiedbright" />مُبلغ: معلومة من المصدر</li>
              <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-goldbright" />يحتاج تحققًا: معلومة متغيرة أو غير مكتملة</li>
            </ul>
          </div>
        </div>
        <div className="mt-14 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-oninverse/45 md:flex-row md:items-center">
          <span>© 2026 الرحلة — THE JOURNEY</span>
          <span>الدليل قبل الادعاء · الصلاحية قبل الوعد</span>
        </div>
      </div>
    </footer>
  );
}
