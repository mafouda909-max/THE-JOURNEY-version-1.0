import Link from "next/link";
import type { Metadata } from "next";
import { SilaPageIntro } from "@/components/brand/SilaPageIntro";
import { CommunityComposer } from "@/components/community/CommunityComposer";
import { CommunityHelpfulButton } from "@/components/community/CommunityHelpfulButton";
import {
  COMMUNITY_POST_TYPES,
  isCommunityEnabled,
  listPublishedCommunityPosts,
} from "@/lib/community";

export const metadata: Metadata = {
  title: "المجتمع",
  description:
    "أسئلة وتجارب وتحديثات سفر يشاركها المجتمع تحت مراجعة واضحة وهوية مصدر قابلة للفهم.",
};

const TYPE_LABEL = Object.fromEntries(
  COMMUNITY_POST_TYPES.map((item) => [item.key, item.label]),
);

export default async function CommunityPage() {
  const enabled = isCommunityEnabled();
  const posts = enabled ? await listPublishedCommunityPosts({ limit: 30 }) : [];

  return (
    <main className="mx-auto min-h-[70vh] max-w-7xl px-5 py-10 md:px-8 md:py-14">
      <SilaPageIntro
        eyebrow="Community · معرفة من الناس"
        title="المجتمع الذي يساعدك تفهم قبل ما تختار."
        description="أسئلة وتجارب وتحديثات مرتبطة بالسفر نفسه. لا نبني Feed للتمرير بلا نهاية؛ كل مشاركة يجب أن تضيف معلومة أو تجربة أو سؤالاً يمكن الاستفادة منه."
        meta={
          <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
            <span className="rounded-full bg-air px-3 py-1.5 text-deep">مراجعة قبل النشر</span>
            <span className="rounded-full bg-low px-3 py-1.5 text-slate">تجربة مؤكدة حين تتوفر</span>
            <span className="rounded-full bg-low px-3 py-1.5 text-slate">مفيد بدل سباق اللايكات</span>
          </div>
        }
      />

      {!enabled ? (
        <section className="sila-window border border-outlinev bg-cloud p-8 text-center shadow-[0_12px_38px_rgba(8,38,74,0.05)] md:p-12">
          <div className="mx-auto flex max-w-2xl flex-col items-center">
            <div className="flex gap-2" aria-hidden>
              <span className="h-3 w-3 rounded-full bg-signal" />
              <span className="h-3 w-3 rounded-full bg-sky" />
            </div>
            <h2 className="mt-5 text-2xl font-bold text-inkwell">طبقة المجتمع جاهزة في الكود.</h2>
            <p className="mt-3 leading-7 text-slate">
              يتم فتحها بعد تطبيق migration قاعدة البيانات وتفعيل Community في بيئة التشغيل. حتى ذلك الحين لا نجري أي استعلامات على جداول غير موجودة.
            </p>
          </div>
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[.72fr_1.28fr]">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <CommunityComposer />
          </div>

          <section className="space-y-4">
            {posts.length === 0 ? (
              <div className="sila-window border border-dashed border-outlinev bg-cloud p-10 text-center">
                <h2 className="text-xl font-bold text-inkwell">لا توجد مشاركات منشورة بعد.</h2>
                <p className="mt-2 text-sm leading-7 text-slate">
                  أول المشاركات ستظهر هنا بعد مراجعتها واعتمادها.
                </p>
              </div>
            ) : (
              posts.map((post) => (
                <article
                  key={post.id}
                  className="sila-window border border-outlinev bg-cloud p-5 shadow-[0_8px_28px_rgba(8,38,74,0.04)] md:p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-air px-2.5 py-1 text-[10px] font-bold text-deep">
                          {TYPE_LABEL[post.type] ?? post.type}
                        </span>
                        {post.topic ? (
                          <span className="text-[11px] font-semibold text-slate">#{post.topic}</span>
                        ) : null}
                      </div>
                      <h2 className="mt-3 text-xl font-bold leading-snug text-inkwell">{post.title}</h2>
                    </div>

                    <div className="text-end text-[11px] text-slate">
                      <div className="font-bold text-deep">{post.author.displayName}</div>
                      <div className="mt-1">
                        {post.author.agentVerificationStatus === "verified"
                          ? "وكيل موثّق"
                          : post.author.role === "agent"
                            ? "وكيل"
                            : "مسافر"}
                      </div>
                    </div>
                  </div>

                  <p className="mt-4 whitespace-pre-line text-sm leading-7 text-slate">{post.body}</p>

                  {post.destinationCountry || post.destinationCity ? (
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <div className="text-[11px] font-semibold text-signal">
                        {[post.destinationCity, post.destinationCountry].filter(Boolean).join(" · ")}
                      </div>
                      <Link
                        href={`/account/travel?source=community&destination=${encodeURIComponent(post.destinationCity ?? post.destinationCountry ?? "")}`}
                        className="rounded-lg bg-air px-3 py-1.5 text-[11px] font-bold text-deep hover:bg-sky/30"
                      >
                        حوّلها إلى نية سفر
                      </Link>
                    </div>
                  ) : null}

                  <div className="mt-5 flex items-center justify-between gap-3 border-t border-outlinev pt-4">
                    <CommunityHelpfulButton postId={post.id} initialCount={post.helpfulCount} />
                    <span className="text-[11px] text-slate">
                      <span className="tnum">{post.commentCount}</span> رد
                    </span>
                  </div>
                </article>
              ))
            )}
          </section>
        </div>
      )}
    </main>
  );
}
