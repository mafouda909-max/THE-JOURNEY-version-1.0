import { useCallback, useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { useApi } from "../api/context";
import { isApiError } from "../api/client";
import type { ContactRequestAccepted, Offer } from "../api/types";
import {
  Badge,
  Card,
  DataRow,
  Field,
  PrimaryButton,
  Screen,
  Stepper,
} from "../components/ui";
import { formatDateTime, formatDuration, formatNumber, formatPrice, formatDate, tripTypeLabel } from "../lib/format";
import {
  EMPTY_CONTACT_DRAFT,
  normaliseContactDraft,
  validateContactDraft,
  type ContactDraft,
  type ContactDraftField,
  type ContactField,
} from "../lib/validation";
import { palette, radius, rtl, spacing, typography } from "../theme";

/** UTM attribution: installs of this app are a measurable acquisition channel. */
const UTM = { utmSource: "mobile_app", utmMedium: "companion", utmCampaign: "v1_foundation" } as const;

export function OfferDetailScreen({ offer, onBack }: { offer: Offer; onBack: () => void }) {
  const client = useApi();
  const [draft, setDraft] = useState<ContactDraft>({
    ...EMPTY_CONTACT_DRAFT,
    offerId: offer.id,
    travelerCount: Math.min(Math.max(2, offer.minTravelers), offer.maxTravelers),
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ContactField, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<ContactRequestAccepted | null>(null);

  const bounds = useMemo(
    () => ({ id: offer.id, minTravelers: offer.minTravelers, maxTravelers: offer.maxTravelers, status: offer.status }),
    [offer.id, offer.maxTravelers, offer.minTravelers, offer.status],
  );

  const setField = useCallback(
    <K extends ContactDraftField>(key: K, value: ContactDraft[K]) => {
      setDraft((prev) => ({ ...prev, [key]: value }));
      setFieldErrors((prev) => {
        // Editing a field clears its own error; `offer` is not editable.
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key as ContactField];
        return next;
      });
    },
    [],
  );

  const submit = useCallback(async () => {
    if (!client) return;
    const errors = validateContactDraft(draft, bounds);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setFailure(null);
      return;
    }
    setSubmitting(true);
    setFailure(null);
    try {
      const result = await client.sendContactRequest({
        ...normaliseContactDraft(draft),
        ...UTM,
      });
      setAccepted(result);
    } catch (cause: unknown) {
      setFailure(isApiError(cause) ? cause.message : "تعذّر إرسال الطلب — حاول مرة أخرى.");
    } finally {
      setSubmitting(false);
    }
  }, [bounds, client, draft]);

  return (
    <Screen
      scroll
      headerTitle="تفاصيل العرض"
      contentContainerStyle={styles.content}
      headerRight={
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="رجوع" hitSlop={8}>
          <Text style={styles.backLabel}>رجوع</Text>
        </Pressable>
      }
    >
      {offer.heroImage ? (
        <Image source={{ uri: offer.heroImage }} style={styles.hero} resizeMode="cover" />
      ) : null}

      <View style={styles.badgeRow}>
        <Badge label={tripTypeLabel(offer.tripType)} tone="neutral" />
        {offer.isFeatured ? <Badge label="مميّز" tone="warn" /> : null}
        {offer.status === "published" ? null : <Badge label="غير متاح" tone="error" />}
      </View>

      <Text style={[styles.title, rtl]}>{offer.title}</Text>
      {offer.titleEn ? <Text style={[styles.subtitle, rtl]}>{offer.titleEn}</Text> : null}

      <Card>
        <DataRow label="السعر" value={formatPrice(offer.priceAmount, offer.currency, offer.priceType)} />
        <DataRow label="المسار" value={`${offer.originCity} ← ${offer.destinationCity}`} />
        <DataRow label="الدولة" value={offer.destinationCountry} />
        <DataRow label="المغادرة" value={formatDate(offer.departureDate)} />
        <DataRow label="المدة" value={formatDuration(offer.durationDays)} />
        <DataRow
          label="عدد المسافرين"
          value={`من ${formatNumber(offer.minTravelers)} إلى ${formatNumber(offer.maxTravelers)}`}
        />
        {offer.expiresAt ? (
          <DataRow label="آخر موعد للحجز" value={formatDate(offer.expiresAt)} />
        ) : null}
      </Card>

      <Card>
        <Text style={[styles.sectionTitle, rtl]}>{offer.description}</Text>
        {offer.includes.length > 0 ? (
          <BlockList title="يشمل" items={offer.includes} tone="positive" />
        ) : null}
        {offer.excludes.length > 0 ? (
          <BlockList title="لا يشمل" items={offer.excludes} tone="negative" />
        ) : null}
      </Card>

      {offer.agent ? (
        <Card>
          <Text style={[styles.cardLabel, rtl]}>الوكيل</Text>
          <Text style={[styles.agentName, rtl]}>{offer.agent.displayName}</Text>
          <Text style={[styles.agentMeta, rtl]}>
            {offer.agent.city} · {offer.agent.country}
          </Text>
          <View style={styles.badgeRow}>
            <Badge
              label={offer.agent.verificationStatus === "verified" ? "موثّق" : "قيد المراجعة"}
              tone={offer.agent.verificationStatus === "verified" ? "verified" : "warn"}
            />
            <Badge label={`استجابة ${formatNumber(offer.agent.responseRate)}٪`} tone="neutral" />
          </View>
        </Card>
      ) : null}

      {accepted ? (
        <Card style={styles.successCard}>
          <Text style={[styles.cardLabel, rtl]}>تم الإرسال</Text>
          <Text style={[styles.successText, rtl]}>{accepted.message}</Text>
          <Text style={[styles.successMeta, rtl]}>
            رقم الطلب {formatNumber(accepted.id)} · {formatDateTime(accepted.createdAt)}
          </Text>
          <PrimaryButton label="حسناً" onPress={onBack} />
        </Card>
      ) : (
        <Card>
          <Text style={[styles.cardLabel, rtl]}>اطلب من الوكيل</Text>
          <Text style={[styles.formHint, rtl]}>
            الطلب يصل الوكيل مباشرةً ولا يُنشر علناً. الرد خلال ٤٨ ساعة كحد أقصى.
          </Text>

          <Field
            label="الاسم"
            value={draft.travelerName}
            onChangeText={(next) => setField("travelerName", next)}
            error={fieldErrors.travelerName}
            placeholder="اسمك الكريم"
            autoCapitalize="words"
            autoComplete="name"
            maxLength={80}
          />
          <Field
            label="البريد الإلكتروني"
            value={draft.travelerEmail}
            onChangeText={(next) => setField("travelerEmail", next)}
            error={fieldErrors.travelerEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            maxLength={254}
          />
          <Stepper
            label="عدد المسافرين"
            value={draft.travelerCount}
            min={offer.minTravelers}
            max={offer.maxTravelers}
            onChange={(next) => setField("travelerCount", next)}
          />
          <Field
            label="مواعيد السفر المبدئية (اختياري)"
            value={draft.travelDates}
            onChangeText={(next) => setField("travelDates", next)}
            placeholder="مثال: ١٥ رمضان — أسبوع"
            maxLength={120}
          />
          <Field
            label="رسالتك"
            value={draft.message}
            onChangeText={(next) => setField("message", next)}
            error={fieldErrors.message}
            placeholder="اكتب سؤالك للوكيل — عدد الغرف، نوع الرحلة، الخ."
            multiline
            numberOfLines={5}
            style={styles.messageInput}
            maxLength={2_000}
          />

          {failure ? (
            <View style={styles.errorBanner}>
              <Text style={[styles.errorText, rtl]} accessibilityRole="alert">
                {failure}
              </Text>
            </View>
          ) : null}

          <PrimaryButton
            label={submitting ? "جارٍ الإرسال…" : "إرسال الطلب"}
            onPress={() => void submit()}
            busy={submitting}
            disabled={!client || offer.status !== "published"}
          />
        </Card>
      )}
    </Screen>
  );
}

function BlockList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "positive" | "negative";
}) {
  return (
    <View style={styles.block}>
      <Text style={[styles.blockTitle, rtl]}>{title}</Text>
      {items.map((item, index) => (
        <Text key={`${title}-${index}`} style={[styles.blockItem, rtl, tone === "negative" ? styles.blockNegative : null]}>
          {tone === "negative" ? "—" : "·"} {item}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  hero: { width: "100%", height: 190, borderRadius: radius.md, backgroundColor: palette.low },
  badgeRow: { flexDirection: "row-reverse", gap: spacing.xs, flexWrap: "wrap" },
  title: { ...typography.title, paddingHorizontal: 2 },
  subtitle: { ...typography.muted, marginBottom: spacing.xs },
  backLabel: { color: palette.cloud, fontSize: 13, fontWeight: "700" },
  cardLabel: { ...typography.label, color: palette.horizon },
  sectionTitle: { ...typography.body, lineHeight: 22 },
  agentName: { ...typography.section, color: palette.inkwell },
  agentMeta: { ...typography.muted },
  formHint: { ...typography.muted, marginBottom: spacing.xs },
  messageInput: { minHeight: 110, textAlignVertical: "top", paddingTop: spacing.md },
  successCard: { borderColor: palette.verified, borderWidth: 1 },
  successText: { ...typography.body, color: palette.verified, fontWeight: "600" },
  successMeta: { ...typography.muted, marginBottom: spacing.sm },
  errorBanner: { backgroundColor: palette.errorBg, borderRadius: radius.sm, padding: spacing.sm },
  errorText: { ...typography.muted, color: palette.error },
  block: { gap: 2 },
  blockTitle: { ...typography.label, marginTop: spacing.sm },
  blockItem: { ...typography.body, color: palette.inkwell },
  blockNegative: { color: palette.slate },
});
