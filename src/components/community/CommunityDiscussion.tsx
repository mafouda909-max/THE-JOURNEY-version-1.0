"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CommunityReportButton } from "@/components/community/CommunityReportButton";
import { CheckCircle2, Loader2, MessageSquareText, Reply, Send, XCircle } from "lucide-react";

type PublishedComment = {
  id: number;
  parentCommentId: number | null;
  body: string;
  createdAt: string;
  author: {
    displayName: string | null;
    role: string;
  };
};

export function CommunityDiscussion({
  postId,
  initialCount,
}: {
  postId: number;
  initialCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [comments, setComments] = useState<PublishedComment[]>([]);
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [body, setBody] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  async function loadComments() {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/community/posts/" + postId + "/comments", { cache: "no-store" });
      const payload = (await response.json()) as { error?: string; comments?: PublishedComment[] };
      if (!response.ok) throw new Error(payload.error ?? "تعذر تحميل النقاش.");
      setComments(payload.comments ?? []);
      setLoaded(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تحميل النقاش.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleDiscussion() {
    const next = !open;
    setOpen(next);
    if (next && !loaded && !loading) await loadComments();
  }

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setMessage(null);
    setNeedsLogin(false);
    try {
      const response = await fetch("/api/community/posts/" + postId + "/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, parentCommentId: replyTo }),
      });
      const payload = (await response.json()) as { error?: string; message?: string };
      if (response.status === 401) {
        setNeedsLogin(true);
        throw new Error(payload.error ?? "سجّل الدخول أولاً.");
      }
      if (!response.ok) throw new Error(payload.error ?? "تعذر إرسال التعليق.");
      setBody("");
      setReplyTo(null);
      setMessage(payload.message ?? "وصل تعليقك للمراجعة.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر إرسال التعليق.");
    } finally {
      setSubmitting(false);
    }
  }

  function dateLabel(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("ar-EG", { year: "numeric", month: "short", day: "numeric" }).format(date);
  }

  const roots = comments.filter((comment) => comment.parentCommentId === null);

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => void toggleDiscussion()}
        aria-expanded={open}
        className="sila-interactive inline-flex items-center gap-2 rounded-full border border-outlinev bg-cloud px-3 py-1.5 text-[11px] font-bold text-slate hover:border-sky hover:text-signal"
      >
        <MessageSquareText className="h-3.5 w-3.5" />
        {open ? "إغلاق النقاش" : "افتح النقاش"}
        <span className="tnum">{initialCount}</span>
      </button>

      {open ? (
        <section className="mt-4 rounded-2xl border border-outlinev bg-low/50 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-inkwell">النقاش حول المشاركة</h3>
            <button type="button" onClick={() => void loadComments()} disabled={loading} className="text-[11px] font-bold text-deep underline underline-offset-4 disabled:opacity-50">
              تحديث
            </button>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-slate">
              <Loader2 className="h-4 w-4 animate-spin" /> جارٍ تحميل التعليقات…
            </div>
          ) : comments.length === 0 ? (
            <p className="py-5 text-sm leading-6 text-slate">لا توجد تعليقات منشورة بعد. ابدأ نقاشاً مفيداً.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {roots.map((comment) => {
                const replies = comments.filter((reply) => reply.parentCommentId === comment.id);
                return (
                  <article key={comment.id} className="rounded-xl border border-outlinev bg-cloud p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="text-xs text-deep">{comment.author.displayName || "مشارك"}</strong>
                      <time className="text-[10px] text-slate">{dateLabel(comment.createdAt)}</time>
                    </div>
                    <p className="mt-2 whitespace-pre-line text-sm leading-7 text-inkwell">{comment.body}</p>
                    <button
                      type="button"
                      onClick={() => { setReplyTo(comment.id); setMessage(null); }}
                      className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-signal hover:text-deep"
                    >
                      <Reply className="h-3.5 w-3.5" /> رد على التعليق
                    </button>
                    <CommunityReportButton targetType="comment" targetId={comment.id} />
                    {replies.length > 0 ? (
                      <div className="mt-3 space-y-2 border-s border-sky ps-4">
                        {replies.map((reply) => (
                          <div key={reply.id} className="rounded-lg bg-low p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <strong className="text-[11px] text-deep">{reply.author.displayName || "مشارك"}</strong>
                              <time className="text-[10px] text-slate">{dateLabel(reply.createdAt)}</time>
                            </div>
                            <p className="mt-1.5 whitespace-pre-line text-xs leading-6 text-inkwell">{reply.body}</p>
                            <CommunityReportButton targetType="comment" targetId={reply.id} />
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}

          <form onSubmit={submitComment} className="mt-4 border-t border-outlinev pt-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <label htmlFor={"community-comment-" + postId} className="text-xs font-bold text-inkwell">
                {replyTo === null ? "أضف تعليقاً" : "اكتب ردك على التعليق"}
              </label>
              {replyTo !== null ? (
                <button type="button" onClick={() => setReplyTo(null)} className="text-[10px] font-semibold text-slate underline">
                  إلغاء الرد
                </button>
              ) : null}
            </div>
            <textarea
              id={"community-comment-" + postId}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              minLength={10}
              maxLength={2000}
              required
              rows={3}
              placeholder="اكتب معلومة أو سؤالاً يساعد صاحب المشاركة والمسافرين…"
              className="w-full resize-y rounded-xl border border-outlinev bg-cloud px-3.5 py-3 text-sm text-inkwell outline-none focus:border-signal focus:ring-4 focus:ring-signal/10"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] leading-5 text-slate">التعليقات والردود تخضع للمراجعة قبل ظهورها.</p>
              <button
                type="submit"
                disabled={submitting || body.trim().length < 10}
                className="inline-flex items-center gap-2 rounded-xl bg-signal px-4 py-2.5 text-xs font-bold text-white hover:bg-horizon disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                إرسال للمراجعة
              </button>
            </div>
            {message ? (
              <div className="mt-3 rounded-lg bg-air/70 px-3 py-2.5 text-xs font-semibold text-deep">
                {message}
                {needsLogin ? <Link href="/join" className="ms-2 underline">تسجيل الدخول</Link> : null}
              </div>
            ) : null}
          </form>
        </section>
      ) : null}
    </div>
  );
}

type PendingComment = {
  id: number;
  postId: number;
  parentCommentId: number | null;
  body: string;
  createdAt: string;
  author: { displayName: string | null; role: string };
  post: { title: string };
};

function ModerationCard({ comment }: { comment: PendingComment }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"publish" | "reject" | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function act(action: "publish" | "reject") {
    if (action === "reject" && reason.trim().length < 5) {
      setError("اكتب سبباً واضحاً للرفض.");
      return;
    }

    setBusy(action);
    setError(null);
    try {
      const response = await fetch("/api/community/comments/" + comment.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "تعذر تنفيذ القرار.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تنفيذ القرار.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="rounded-2xl border border-outlinev bg-cloud p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-bold text-deep">{comment.author.displayName || "مشارك"}</div>
        <time className="text-[10px] text-slate">{new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" }).format(new Date(comment.createdAt))}</time>
      </div>
      <div className="mt-2 text-[11px] font-semibold text-signal">المشاركة: {comment.post.title} · #{comment.postId}</div>
      {comment.parentCommentId !== null ? <div className="mt-1 text-[10px] text-slate">رد على التعليق رقم {comment.parentCommentId}</div> : null}
      <p className="mt-3 whitespace-pre-line text-sm leading-7 text-inkwell">{comment.body}</p>
      {error ? <p className="mt-3 rounded-lg bg-errorbg px-3 py-2 text-xs font-semibold text-error">{error}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => void act("publish")} disabled={busy !== null} className="inline-flex items-center gap-2 rounded-lg bg-verified px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">
          {busy === "publish" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          اعتماد ونشر
        </button>
        <button type="button" onClick={() => void act("reject")} disabled={busy !== null} className="inline-flex items-center gap-2 rounded-lg border border-error/30 px-4 py-2.5 text-xs font-bold text-error disabled:opacity-50">
          {busy === "reject" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
          رفض
        </button>
      </div>
      <input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        maxLength={500}
        placeholder="سبب الرفض (مطلوب عند الرفض)"
        className="mt-3 w-full rounded-lg border border-outlinev bg-low px-3 py-2.5 text-xs outline-none focus:border-signal"
      />
    </article>
  );
}

export function CommunityModerationQueue({ comments }: { comments: PendingComment[] }) {
  const router = useRouter();
  if (comments.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-outlinev bg-cloud p-8 text-center">
        <h2 className="font-bold text-inkwell">لا توجد تعليقات تنتظر المراجعة.</h2>
        <p className="mt-2 text-sm text-slate">ستظهر هنا التعليقات والردود الجديدة على المشاركات المنشورة.</p>
        <button type="button" onClick={() => router.refresh()} className="mt-4 text-xs font-bold text-deep underline">تحديث القائمة</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-xs font-semibold text-slate">تعليقات تنتظر قرار المشرف: <span className="tnum text-deep">{comments.length}</span></div>
      {comments.map((comment) => <ModerationCard key={comment.id} comment={comment} />)}
    </div>
  );
}
