"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, X, Send, Bot, ShieldCheck, ArrowUpRight } from "lucide-react";
import Link from "next/link";

interface Message {
  id: string;
  sender: "user" | "advisor";
  text: string;
  source?: "gemini" | "sila_engine";
  visaContext?: {
    country: string;
    type: string;
    portal: string;
  } | null;
}

const QUICK_PROMPTS = [
  "شروط فيزا تركيا للمصريين حالياً؟",
  "ميزانية أسبوع في جورجيا لشخصين؟",
  "إجراءات السفر إلى المالديف وهل الفيزا عند الوصول؟",
  "تأشيرة العمرة والسياحة للسعودية",
];

export function AdvisorDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "initial",
      sender: "advisor",
      text: "أهلاً بك! أنا مستشار صلة الذكي. يمكنك سؤالي عن متطلبات أي تأشيرة، خطوات التخطيط لوجهتك، أو الميزانية التقديرية لرحلتك.",
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Hide inside agency workspace to avoid distraction during work
  if (pathname?.startsWith("/account")) {
    return null;
  }

  async function handleSend(textToSend?: string) {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const userMessage: Message = {
      id: `u-${Date.now()}`,
      sender: "user",
      text,
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!textToSend) setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();
      const advisorMessage: Message = {
        id: `a-${Date.now()}`,
        sender: "advisor",
        text: data.reply || "عذراً، لم أستطع فهم السؤال بوضوح. هل يمكنك إعادة صياغته؟",
        source: data.source,
        visaContext: data.visaContext,
      };

      setMessages((prev) => [...prev, advisorMessage]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: "advisor",
          text: "تعذر الاتصال بالمستشار حالياً. يمكنك تصفح دليل التأشيرات الرسمي أو تجربة السؤال مجدداً.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Floating Launcher Button */}
      <div className="fixed bottom-6 end-6 z-[70]">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="sila-motion-safe group flex items-center gap-2.5 rounded-full border border-sky/30 bg-deep px-4 py-3 text-white shadow-[0_12px_36px_rgba(8,38,74,0.35)] transition-all duration-300 hover:-translate-y-1 hover:border-sky hover:bg-horizon hover:shadow-[0_16px_40px_rgba(8,38,74,0.45)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky/30"
          aria-label="افتح مستشار صلة الذكي"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-signal text-white shadow-inner">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="text-sm font-bold tracking-tight">استشر صلة</span>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
        </button>
      </div>

      {/* Drawer & Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm"
              aria-hidden="true"
            />

            {/* Slide-over Drawer */}
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="fixed inset-y-0 end-0 z-[100] flex w-full max-w-md flex-col border-s border-outlinev bg-cloud shadow-2xl"
              dir="rtl"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-outlinev bg-deep px-5 py-4 text-white">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-signal text-white shadow-sm">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold leading-tight">مستشار صلة الذكي</h2>
                    <p className="text-[11px] text-white/70">
                      مشورة سفر مدعومة بالمصادر الرسمية المعتمدة
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
                  aria-label="إغلاق المستشار"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Messages Container */}
              <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-5">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.sender === "user" ? "justify-start" : "justify-end"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed shadow-sm ${
                        m.sender === "user"
                          ? "rounded-tr-xs bg-signal text-white"
                          : "rounded-tl-xs border border-outlinev bg-mist text-inkwell"
                      }`}
                    >
                      <p className="whitespace-pre-line">{m.text}</p>

                      {m.visaContext && (
                        <div className="mt-3 rounded-xl border border-emerald-300/30 bg-emerald-50/80 p-2.5 text-xs text-emerald-950">
                          <div className="flex items-center gap-1 font-bold">
                            <ShieldCheck className="h-3.5 w-3.5 text-verified" />
                            {m.visaContext.country} ({m.visaContext.type})
                          </div>
                          <a
                            href={m.visaContext.portal}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1.5 inline-flex items-center gap-1 font-semibold text-deep hover:underline"
                          >
                            <span>رابط البوابة الحكومية</span>
                            <ArrowUpRight className="h-3 w-3" />
                          </a>
                        </div>
                      )}

                      {m.sender === "advisor" && m.source && (
                        <div className="mt-2 text-start text-[10px] text-slate/60">
                          {m.source === "gemini" ? "مدعوم بنموذج Gemini" : "قواعد صلة المعتمدة"}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-end">
                    <div className="flex items-center gap-2 rounded-2xl border border-outlinev bg-mist px-4 py-3 text-xs text-slate">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-signal" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-sky delay-100" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-deep delay-200" />
                      <span>جاري استحضار المشورة وفحص المصادر...</span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Prompts */}
              {messages.length <= 2 && (
                <div className="border-t border-outlinev/70 bg-low/30 px-4 py-3">
                  <p className="mb-2 text-[11px] font-bold text-slate">أسئلة شائعة يمكنك النقر عليها:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => void handleSend(prompt)}
                        className="rounded-full border border-outlinev bg-cloud px-3 py-1 text-xs text-slate hover:border-deep hover:text-deep"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input Footer */}
              <div className="border-t border-outlinev bg-cloud p-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleSend();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="اسأل عن وجهة، تأشيرة، أو ميزانية..."
                    className="flex-1 rounded-xl border border-outlinev bg-mist px-4 py-2.5 text-sm text-inkwell placeholder:text-slate/60 focus:border-signal focus:bg-cloud focus:outline-none"
                    disabled={loading}
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || loading}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-deep text-white shadow-sm transition hover:bg-horizon disabled:opacity-40"
                    aria-label="إرسال"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>

                <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate/70">
                  <span>مشورة محايدة لا تتوسط في البيع</span>
                  <Link
                    href="/sila"
                    onClick={() => setIsOpen(false)}
                    className="font-semibold text-deep hover:underline"
                  >
                    بناء ملف رحلة كامل
                  </Link>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
