"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { SilaConversationIcon } from "@/components/brand/SilaIcons";

export function CommunityComposer() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setNeedsLogin(false);

    const form = event.currentTarget;
    const data = new FormData(form);

    try {
      const res = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: data.get("type"),
          title: data.get("title"),
          body: data.get("body"),
          destinationCountry: data.get("destinationCountry"),
          destinationCity: data.get("destinationCity"),
          topic: data.get("topic"),
        }),
      });
      const json = (await res.json()) as { error?: string; message?: string };
      if (res.status === 401) {
        setNeedsLogin(true);
        setMessage(json.error ?? "سجّل الدخول أولاً.");
        return;
      }
      if (!res.ok) throw new Error(json.error ?? "تعذر إرسال المشاركة");
      setMessage(json.message ?? "وصلت المشاركة للمراجعة.");
      form.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر إرسال المشاركة");
    } finally {
      setBusy(false);
    }
  }

  const field =
    "w-full rounded-2xl border border-outlinev bg-low/60 px-4 py-3 text-sm font-semibold text-inkwell outline-none transition-all focus:border-signal focus:bg-cloud focus:ring-4 focus:ring-signal/10";

  return (
    <form
      onSubmit={submit}
      className="sila-window border border-outlinev bg-cloud p-5 shadow-[0_12px_38px_rgba(8,38,74,0.05)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="sila-eyebrow text-[11px] font-semibold text-signal">
            أضف شيئًا يفيد مسافرًا آخر
          </div>
          <h2 className="mt-2 text-xl font-bold text-inkwell">شارك سؤالًا أو تجربة.</h2>
        </div>
        <SilaConversationIcon className="h-6 w-6 text-signal" />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <select name="type" defaultValue="question" className={field}>
          <option value="question">سؤال</option>
          <option value="experience">تجربة</option>
          <option value="update">تحديث</option>
          <option value="guide">دليل</option>
        </select>
        <input name="topic" maxLength={64} placeholder="الموضوع: تأشيرة، طيران، فندق…" className={field} />
      </div>

      <input
        name="title"
        required
        minLength={10}
        maxLength={180}
        placeholder="عنوان واضح يساعد الناس تفهم الموضوع"
        className={`${field} mt-3`}
      />

      <textarea
        name="body"
        required
        minLength={20}
        maxLength={4000}
        rows={5}
        placeholder="اكتب التفاصيل التي تعرفها فقط. لا تنشر بيانات شخصية أو وعودًا غير مؤكدة."
        className={`${field} mt-3 resize-y`}
      />

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <input name="destinationCountry" maxLength={80} placeholder="الدولة (اختياري)" className={field} />
        <input name="destinationCity" maxLength={80} placeholder="المدينة (اختياري)" className={field} />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-outlinev pt-4">
        <p className="max-w-xl text-[11px] leading-5 text-slate">
          كل مشاركة جديدة تدخل المراجعة قبل الظهور العام. المجتمع ليس مكانًا لتحويلات خارجية أو بيانات اتصال شخصية.
        </p>
        <button
          type="submit"
          disabled={busy}
          className="sila-interactive inline-flex min-h-[44px] items-center gap-2 rounded-2xl bg-signal px-5 py-2.5 text-sm font-bold text-white hover:-translate-y-0.5 hover:bg-horizon disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <SilaConversationIcon className="h-4 w-4" />}
          إرسال للمراجعة
        </button>
      </div>

      {message ? (
        <div className="mt-4 rounded-xl bg-air/60 px-4 py-3 text-[12px] font-semibold text-deep">
          {message}
          {needsLogin ? (
            <Link href="/join" className="ms-2 underline underline-offset-4">
              تسجيل الدخول
            </Link>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
