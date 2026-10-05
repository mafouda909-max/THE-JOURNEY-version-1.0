"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Save, UserRound } from "lucide-react";
import { accountAction } from "@/lib/account-action";
import {
  agentVerificationState,
  type AgentProfile,
} from "@/lib/agent-workspace";
import { primaryAction, secondaryAction } from "./WorkspaceParts";

export function AgentProfileEditor({
  initialProfile,
}: {
  initialProfile: AgentProfile;
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [saved, setSaved] = useState(initialProfile);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const dirty = JSON.stringify(profile) !== JSON.stringify(saved);
  const state = agentVerificationState(profile.verificationStatus);
  const update = (key: keyof AgentProfile, value: string) => {
    setProfile((current) => ({ ...current, [key]: value }));
    setMessage(null);
  };

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const data = await accountAction(
        "/api/agent-verification",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName: profile.displayName,
            latinName: profile.latinName,
            bio: profile.bio,
            city: profile.city,
            country: profile.country,
            licenseType: profile.licenseType,
            licenseNumber: profile.licenseNumber,
          }),
        },
        "تعذر حفظ الملف. حاول مرة أخرى.",
      );
      const updated = data.agent as AgentProfile | undefined;
      if (!updated || typeof updated.displayName !== "string")
        throw new Error(
          "تعذر تأكيد حفظ الملف. حدّث الصفحة قبل المحاولة مجددًا.",
        );
      setProfile(updated);
      setSaved(updated);
      setMessage(
        typeof data.message === "string"
          ? data.message
          : "تم حفظ بيانات الملف.",
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حفظ الملف.");
    } finally {
      setBusy(false);
    }
  }

  const field =
    "mt-2 min-h-11 w-full rounded-xl border border-outlinev bg-cloud px-3.5 py-3 text-sm font-normal text-deep outline-none transition-colors focus:border-signal focus:ring-2 focus:ring-signal/20";
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <form
        onSubmit={(event) => void save(event)}
        className="sila-window border border-outlinev bg-cloud p-5 sm:p-6"
      >
        <h2 className="text-lg font-bold text-deep">بياناتك المهنية</h2>
        <p className="mt-2 text-sm leading-7 text-slate">
          حفظ هذه البيانات لا يتطلب مستندات ولا يبدأ التوثيق. يمكنك تعديلها قبل
          التقديم.
        </p>
        {profile.verificationStatus === "verified" && (
          <p className="mt-4 rounded-xl bg-amber p-4 text-sm leading-7 text-deep">
            تغيير الاسم أو الموقع أو بيانات الترخيص يعيد الملف للمراجعة ويوقف
            ظهوره العام حتى الاعتماد مجددًا.
          </p>
        )}
        <fieldset
          disabled={busy}
          className="mt-6 grid gap-5 disabled:opacity-70 sm:grid-cols-2"
        >
          <label className="text-sm font-semibold text-deep">
            الاسم المهني
            <input
              required
              name="displayName"
              autoComplete="organization"
              maxLength={120}
              value={profile.displayName}
              onChange={(event) => update("displayName", event.target.value)}
              className={field}
            />
          </label>
          <label className="text-sm font-semibold text-deep">
            الاسم بالإنجليزية
            <input
              required
              name="latinName"
              dir="ltr"
              maxLength={120}
              value={profile.latinName}
              onChange={(event) => update("latinName", event.target.value)}
              className={field}
            />
          </label>
          <label className="text-sm font-semibold text-deep">
            الدولة
            <input
              required
              name="country"
              autoComplete="country-name"
              maxLength={120}
              value={profile.country}
              onChange={(event) => update("country", event.target.value)}
              className={field}
            />
          </label>
          <label className="text-sm font-semibold text-deep">
            المدينة
            <input
              required
              name="city"
              autoComplete="address-level2"
              maxLength={120}
              value={profile.city}
              onChange={(event) => update("city", event.target.value)}
              className={field}
            />
          </label>
          <label className="text-sm font-semibold text-deep">
            نوع النشاط
            <select
              name="licenseType"
              value={profile.licenseType}
              onChange={(event) => update("licenseType", event.target.value)}
              className={field}
            >
              <option value="individual">وكيل فرد</option>
              <option value="agency">وكالة / كيان</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-deep">
            رقم الترخيص{" "}
            {profile.licenseType === "agency" ? "(مطلوب للوكالة)" : "(اختياري)"}
            <input
              required={profile.licenseType === "agency"}
              name="licenseNumber"
              maxLength={40}
              value={profile.licenseNumber ?? ""}
              onChange={(event) => update("licenseNumber", event.target.value)}
              className={field}
            />
          </label>
          <div className="sm:col-span-2">
            <label htmlFor="professional-bio" className="block text-sm font-semibold text-deep">نبذة عن خبرتك وخدماتك</label>
            <textarea
              id="professional-bio"
              required
              name="bio"
              rows={5}
              minLength={30}
              maxLength={1200}
              value={profile.bio}
              onChange={(event) => update("bio", event.target.value)}
              className={field}
              aria-describedby="profile-bio-help"
            />
            <span
              id="profile-bio-help"
              className="mt-2 block text-xs font-normal leading-6 text-slate"
            >
              30 حرفًا على الأقل. اذكر الخدمات والمناطق التي تعمل فيها، وتجنّب
              وعودًا لا يمكنك إثباتها.
            </span>
          </div>
        </fieldset>
        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-errorbg p-4 text-sm leading-7 text-error"
          >
            {error}
          </p>
        )}
        {message && (
          <p
            role="status"
            className="mt-5 rounded-xl bg-air p-4 text-sm leading-7 text-deep"
          >
            {message}
          </p>
        )}
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={busy}
            className={`${primaryAction} disabled:opacity-60`}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="h-4 w-4" aria-hidden="true" />
            )}
            {busy ? "جارٍ الحفظ…" : "حفظ الملف المهني"}
          </button>
          <span className="text-xs text-slate">
            {dirty ? "تغييرات لم تُحفظ بعد" : "لا تغييرات جديدة"}
          </span>
        </div>
      </form>
      <aside className="space-y-5">
        <section
          aria-label="معاينة خاصة للملف"
          className="sila-window border border-outlinev bg-cloud p-5 sm:p-6"
        >
          <p className="sila-eyebrow text-xs font-semibold text-signal">
            معاينة خاصة
          </p>
          <div className="mt-5 flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-air text-signal">
              <UserRound className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="break-words text-lg font-bold leading-8 text-deep">
                <bdi>{profile.displayName || "اسمك المهني"}</bdi>
              </h2>
              <p className="mt-1 break-words text-sm text-slate">
                {[profile.city, profile.country].filter(Boolean).join("، ") ||
                  "مكان عملك"}
              </p>
            </div>
          </div>
          <p className="mt-5 whitespace-pre-wrap break-words text-sm leading-8 text-slate">
            {profile.bio || "نبذتك المهنية تظهر هنا أثناء الكتابة."}
          </p>
          <div className="mt-5 border-t border-outlinev pt-4">
            <span
              className={`inline-flex rounded-lg px-3 py-1.5 text-xs font-semibold ${state.tone === "verified" ? "bg-verifiedbg text-verified" : "bg-low text-slate"}`}
            >
              اعتماد الوكيل: {state.label}
            </span>
            <p className="mt-3 text-xs leading-6 text-slate">
              هذه معاينة لك فقط. البيانات غير المحفوظة لا تُنشر. الظهور
              للمسافرين يخضع لاعتماد الوكيل.
            </p>
          </div>
        </section>
        <section className="rounded-2xl border border-outlinev p-5">
          <h2 className="text-sm font-bold text-deep">
            الخطوة التالية باختيارك
          </h2>
          <p className="mt-2 text-sm leading-7 text-slate">
            عندما تكون جاهزًا للظهور وتقديم عروضك، افتح ملف التوثيق وراجع
            المستندات المطلوبة.
          </p>
          <Link
            href="/account/verification"
            className={`${secondaryAction} mt-4`}
          >
            ملف توثيق الوكيل
          </Link>
        </section>
      </aside>
    </div>
  );
}
