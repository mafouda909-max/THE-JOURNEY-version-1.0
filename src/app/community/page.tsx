import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { CommunityFeed } from "@/components/community/CommunityFeed";
import { listPostsServer } from "@/lib/data/community";

export const metadata: Metadata = {
  title: "مجتمع السفر | صلة - THE JOURNEY",
  description:
    "شارك تجاربك السياحية، استفسر عن الوجهات، وتواصل مع المسافرين والوكلاء المعتمدين في مجتمع صلة.",
};

export default async function CommunityPage() {
  const posts = await listPostsServer();

  return (
    <div className="min-h-dvh bg-surface">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-outline-variant bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6 lg:px-10">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <span aria-hidden className="size-7 rounded-full bg-[#1A2B6D]" />
              <span className="text-title-lg font-bold text-[#1A2B6D]">صلة</span>
              <span className="text-label-sm text-on-surface-variant font-medium">| مجتمع السفر</span>
            </Link>
            <nav className="hidden md:flex items-center gap-4 text-label-md">
              <Link href="/" className="text-on-surface-variant hover:text-primary transition-colors">
                الرئيسية
              </Link>
              <Link href="/offers" className="text-on-surface-variant hover:text-primary transition-colors">
                عروض السفر
              </Link>
              <Link href="/visas" className="text-on-surface-variant hover:text-primary transition-colors">
                التأشيرات والاكتشاف
              </Link>
              <Link href="/community" className="font-bold text-[#1A2B6D]">
                المجتمع
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/offers"
              className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant px-3.5 py-1.5 text-label-sm font-medium text-on-surface hover:bg-surface-container"
            >
              <Icon name="local_offer" className="text-sm text-primary" />
              تصفح العروض
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Header */}
      <section className="border-b border-outline-variant bg-gradient-to-b from-[#1A2B6D]/5 to-transparent py-10 md:py-14">
        <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-10">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1A2B6D]/10 px-3 py-1 text-label-sm font-bold text-[#1A2B6D]">
              <Icon name="groups" className="text-sm" />
              مجتمع صلة التفاعلي
            </span>
            <h1 className="mt-3 text-display-sm md:text-display-md font-bold text-[#1A2B6D]">
              خلاصة وتجارب المسافرين
            </h1>
            <p className="mt-2 text-body-lg text-on-surface-variant">
              مكانك لمشاركة ذكرياتك السياحية، طرح الأسئلة عن الوجهات، والاستفادة من نصائح المسافرين
              والوكلاء المعتمدين بكل شفافية وموثوقية.
            </p>
          </div>
        </div>
      </section>

      {/* Feed Main Content */}
      <main className="mx-auto max-w-4xl px-4 py-8 md:px-6">
        <CommunityFeed initialPosts={posts} />
      </main>

      <footer className="mt-16 border-t border-outline-variant py-8 text-center text-label-md text-on-surface-variant">
        صلة © 2026 — منصة السفر والمجتمع الموثوق
      </footer>
    </div>
  );
}
