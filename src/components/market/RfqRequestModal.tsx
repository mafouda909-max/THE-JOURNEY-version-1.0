"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FileText, X, CheckCircle2, ShieldCheck, Send } from "lucide-react";

export function RfqRequestModal({
  defaultDestination = "",
  buttonText = "اطلب عرض سعر مخصص (RFQ)",
  buttonClassName,
}: {
  defaultDestination?: string;
  buttonText?: string;
  buttonClassName?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    travelerName: "",
    travelerEmail: "",
    travelerPhone: "",
    originCity: "القاهرة",
    destinationCountry: defaultDestination,
    destinationCity: "",
    travelDates: "",
    travelerCount: 2,
    tripType: "package",
    budgetPreference: "moderate",
    notes: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/rfq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "تعذر إرسال الطلب");
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setSubmitted(false);
    setError(null);
    setIsOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={
          buttonClassName ||
          "inline-flex items-center gap-2 rounded-xl bg-signal px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-horizon focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-signal/20"
        }
      >
        <FileText className="h-4 w-4" />
        <span>{buttonText}</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleReset}
              className="fixed inset-0 bg-black/50 backdrop-blur-xs"
              aria-hidden="true"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="sila-window relative z-10 max-h-[90vh] w-full max-w-xl overflow-y-auto border border-outlinev bg-cloud p-6 shadow-2xl md:p-8"
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b border-outlinev/70 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-inkwell">طلب عرض أسعار مباشر (RFQ)</h3>
                  <p className="mt-1 text-xs text-slate">
                    احصل على عروض مخصصة من وكلاء معتمدين بدون دفع مسبق إجباري.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-lg p-1.5 text-slate hover:bg-low hover:text-deep"
                  aria-label="إغلاق النافذة"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {submitted ? (
                <div className="py-8 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-verifiedbg text-verified">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h4 className="mt-4 text-2xl font-bold text-inkwell">تم إرسال طلبك بنجاح!</h4>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate">
                    طلبك الآن متاح للوكلاء الموثّقين المتخصصين في وجهة ({formData.destinationCountry || "المختارة"}).
                    سيتواصل معك الوكلاء مباشرة عبر بريدك الإلكتروني لتقديم خيارات الأسعار.
                  </p>
                  <div className="mt-6">
                    <button
                      type="button"
                      onClick={handleReset}
                      className="rounded-xl bg-deep px-6 py-2.5 text-sm font-bold text-white hover:bg-horizon"
                    >
                      إغلاق
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                  {error && (
                    <div className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">
                      {error}
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold text-deep">الاسم الكامل *</label>
                      <input
                        type="text"
                        required
                        value={formData.travelerName}
                        onChange={(e) => setFormData({ ...formData, travelerName: e.target.value })}
                        placeholder="محمد علي"
                        className="mt-1.5 w-full rounded-xl border border-outlinev bg-mist px-3.5 py-2.5 text-sm text-inkwell focus:border-signal focus:bg-cloud focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-deep">البريد الإلكتروني للتواصل *</label>
                      <input
                        type="email"
                        required
                        value={formData.travelerEmail}
                        onChange={(e) => setFormData({ ...formData, travelerEmail: e.target.value })}
                        placeholder="name@example.com"
                        className="mt-1.5 w-full rounded-xl border border-outlinev bg-mist px-3.5 py-2.5 text-sm text-inkwell focus:border-signal focus:bg-cloud focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold text-deep">مدينة الانطلاق *</label>
                      <input
                        type="text"
                        required
                        value={formData.originCity}
                        onChange={(e) => setFormData({ ...formData, originCity: e.target.value })}
                        placeholder="القاهرة، الرياض، جدة..."
                        className="mt-1.5 w-full rounded-xl border border-outlinev bg-mist px-3.5 py-2.5 text-sm text-inkwell focus:border-signal focus:bg-cloud focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-deep">بلد الوجهة المخطط له *</label>
                      <input
                        type="text"
                        required
                        value={formData.destinationCountry}
                        onChange={(e) => setFormData({ ...formData, destinationCountry: e.target.value })}
                        placeholder="تركيا، جورجيا، المالديف..."
                        className="mt-1.5 w-full rounded-xl border border-outlinev bg-mist px-3.5 py-2.5 text-sm text-inkwell focus:border-signal focus:bg-cloud focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs font-bold text-deep">التواريخ المرجوة</label>
                      <input
                        type="text"
                        value={formData.travelDates}
                        onChange={(e) => setFormData({ ...formData, travelDates: e.target.value })}
                        placeholder="مثال: منتصف يوليو"
                        className="mt-1.5 w-full rounded-xl border border-outlinev bg-mist px-3.5 py-2.5 text-sm text-inkwell focus:border-signal focus:bg-cloud focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-deep">عدد المسافرين</label>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={formData.travelerCount}
                        onChange={(e) => setFormData({ ...formData, travelerCount: Number(e.target.value) })}
                        className="tnum mt-1.5 w-full rounded-xl border border-outlinev bg-mist px-3.5 py-2.5 text-sm text-inkwell focus:border-signal focus:bg-cloud focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-deep">فئة الميزانية</label>
                      <select
                        value={formData.budgetPreference}
                        onChange={(e) => setFormData({ ...formData, budgetPreference: e.target.value })}
                        className="mt-1.5 w-full rounded-xl border border-outlinev bg-mist px-3.5 py-2.5 text-sm text-inkwell focus:border-signal focus:bg-cloud focus:outline-none"
                      >
                        <option value="economic">اقتصادية ومدروسة</option>
                        <option value="moderate">متوسطة ومريحة</option>
                        <option value="luxury">فاخرة ومميزة</option>
                        <option value="open">مرن حسب العرض</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-deep">تفاصيل إضافية أو طلبات خاصة</label>
                    <textarea
                      rows={3}
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="اذكر أي تفضيلات (فنادق 4 نجوم، أنشطة للأطفال، طيران مباشر...)"
                      className="mt-1.5 w-full rounded-xl border border-outlinev bg-mist px-3.5 py-2.5 text-sm text-inkwell focus:border-signal focus:bg-cloud focus:outline-none"
                    />
                  </div>

                  {/* Trust footer banner */}
                  <div className="flex items-start gap-2.5 rounded-xl border border-verified/20 bg-verifiedbg/40 p-3 text-xs text-deep">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-verified" />
                    <span>
                      التواصل مباشر مع الوكلاء الموثّقين. منصة صلة لا تفرض رسوماً وسيطة ولا تطلب منك أي دفع مسبق إجباري لتقديم طلب السعر.
                    </span>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleReset}
                      className="rounded-xl border border-outlinev px-4 py-2.5 text-xs font-semibold text-slate hover:bg-low"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex items-center gap-2 rounded-xl bg-deep px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-horizon disabled:opacity-50"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>{loading ? "جاري الإرسال..." : "إرسال طلب العرض (مجاناً)"}</span>
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
