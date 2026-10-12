"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const QUICK_PROMPTS = [
  "ما هي شروط تأشيرة جورجيا والشنغن؟",
  "اقترح وجهة عائلية بميزانية 8000 ريال",
  "كيف أطلب عرض سعر مخصص (RFQ) في صلة؟",
  "أفضل وقت لزيارة الشمال التركي؟",
];

export function AdvisorDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "أهلاً بك يا مسافر! أنا «مستشار صلة الذكي» المدعوم بـ Google Gemini.\n\nيسعدني مساعدتك في الإجابة عن متطلبات التأشيرات الحكومية، تخطيط ميزانية رحلتك، واقتراح أفضل الوجهات وعروض الأسعار المخصصة. كيف أستطيع خدمتك اليوم؟",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isLoading) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("فشل الاتصال بالمستشار الذكي");
      }

      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantContent = "";

        const assistantMsgId = `a-${Date.now()}`;
        setMessages((prev) => [
          ...prev,
          { id: assistantMsgId, role: "assistant", content: "" },
        ]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          assistantContent += chunk;

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId ? { ...msg, content: assistantContent } : msg,
            ),
          );
        }
      } else {
        const text = await response.text();
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: "assistant", content: text },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "عذراً، حدث خطأ أثناء معالجة استفسارك. يرجى المحاولة مرة أخرى.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 left-6 z-50 flex items-center gap-2.5 rounded-full bg-[#1A2B6D] px-4 py-3 text-white shadow-xl hover:bg-[#1A2B6D]/90 transition-all hover:scale-105 active:scale-95 group"
          aria-label="افتح المستشار الذكي"
        >
          <span className="relative flex size-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex size-3 rounded-full bg-emerald-500"></span>
          </span>
          <span className="flex size-7 items-center justify-center rounded-full bg-white/10">
            <Icon name="smart_toy" className="text-lg text-emerald-300" />
          </span>
          <span className="text-label-lg font-bold">المستشار الذكي</span>
        </button>
      )}

      {/* Floating Sidekick Drawer / Panel */}
      {isOpen && (
        <div className="fixed bottom-6 left-6 z-50 flex h-[580px] w-[90vw] max-w-[420px] flex-col overflow-hidden rounded-2xl border border-outline-variant bg-surface shadow-2xl animate-in slide-in-from-bottom-5 duration-200">
          {/* Drawer Header */}
          <div className="flex items-center justify-between border-b border-outline-variant bg-[#1A2B6D] px-4 py-3 text-white">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-white/15">
                <Icon name="smart_toy" className="text-lg text-emerald-300" />
              </span>
              <div>
                <h3 className="text-title-sm font-bold leading-tight">مستشار صلة الذكي</h3>
                <span className="flex items-center gap-1 text-label-xs text-emerald-200">
                  <span className="size-1.5 rounded-full bg-emerald-400" />
                  مدعوم بنموذج Google Gemini
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() =>
                  setMessages([
                    {
                      id: "welcome-reset",
                      role: "assistant",
                      content: "تمت إعادة تعيين المحادثة. كيف يمكنني مساعدتك في رحلتك القادمة؟",
                    },
                  ])
                }
                title="محادثة جديدة"
                className="rounded-lg p-1.5 text-white/80 hover:bg-white/10 transition-colors"
              >
                <Icon name="refresh" className="text-base" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-white/80 hover:bg-white/10 transition-colors"
              >
                <Icon name="close" className="text-xl" />
              </button>
            </div>
          </div>

          {/* Quick Hub Deep Links */}
          <div className="flex items-center justify-around border-b border-outline-variant/60 bg-surface-container/50 px-2 py-2 text-label-xs">
            <Link
              href="/visas"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-1 font-semibold text-primary hover:underline"
            >
              <Icon name="verified" className="text-xs text-emerald-600" />
              دليل التأشيرات
            </Link>
            <span className="text-outline-variant">•</span>
            <Link
              href="/community"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-1 font-semibold text-primary hover:underline"
            >
              <Icon name="groups" className="text-xs text-blue-600" />
              المجتمع
            </Link>
            <span className="text-outline-variant">•</span>
            <Link
              href="/offers"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-1 font-semibold text-primary hover:underline"
            >
              <Icon name="local_offer" className="text-xs text-amber-600" />
              تصفح العروض
            </Link>
          </div>

          {/* Chat Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-body-sm scrollbar-thin">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 leading-relaxed ${
                    m.role === "user"
                      ? "bg-[#1A2B6D] text-white rounded-bl-xs"
                      : "bg-surface-container text-on-surface rounded-br-xs border border-outline-variant/60 whitespace-pre-line"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-2xl bg-surface-container px-4 py-2.5 text-on-surface-variant border border-outline-variant/60">
                  <span className="size-2 animate-bounce rounded-full bg-primary" />
                  <span className="size-2 animate-bounce rounded-full bg-primary [animation-delay:0.2s]" />
                  <span className="size-2 animate-bounce rounded-full bg-primary [animation-delay:0.4s]" />
                  <span className="text-label-xs mr-1">المستشار يفكر...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Chips */}
          <div className="border-t border-outline-variant/60 bg-surface px-3 py-2">
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {QUICK_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  disabled={isLoading}
                  onClick={() => handleSend(prompt)}
                  className="shrink-0 rounded-full bg-surface-container px-2.5 py-1 text-label-xs font-medium text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {/* Input Footer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2 border-t border-outline-variant bg-surface p-3"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="اسأل المستشار عن وجهة، تأشيرة، أو ميزانية..."
              className="flex-1 rounded-xl border border-outline-variant bg-surface px-3.5 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="flex size-10 items-center justify-center rounded-xl bg-[#1A2B6D] text-white hover:bg-[#1A2B6D]/90 disabled:opacity-50 transition-colors"
            >
              <Icon name="send" className="text-base rtl:rotate-180" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
