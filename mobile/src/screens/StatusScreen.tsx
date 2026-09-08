import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useApi, useApiContext } from "../api/context";
import type { Settled } from "../api/client";
import type { HealthResponse } from "../api/types";
import { Badge, Card, DataRow, PrimaryButton, Screen, StateBlock } from "../components/ui";
import { useApiResource } from "../hooks/useApiResource";
import { createTtlCache } from "../lib/cache";
import { CACHE_MAX_AGE_MS, OFFERS_CACHE_TTL_MS, AGENTS_CACHE_TTL_MS } from "../lib/config";
import { TRIP_TYPES, formatDateTime, formatNumber } from "../lib/format";
import { deviceStore } from "../lib/runtime";
import { palette, radius, rtl, spacing, typography } from "../theme";

type Report = Settled<HealthResponse> & { checkedAt: number };

/** Namespaces the app writes to — enumerated so a "clear" is exhaustive. */
const CACHE_NAMESPACES: string[] = [
  ...["all", ...TRIP_TYPES.map((t) => t.key)].map((key) => `offers:v1:${key}`),
  "agents:v1",
];

const STATUS_TONES = {
  HEALTHY: "verified",
  DEGRADED: "warn",
  NOT_CONFIGURED: "warn",
  UNAVAILABLE: "error",
} as const;

export function StatusScreen() {
  const client = useApi();
  const { config } = useApiContext();
  const [clearedAt, setClearedAt] = useState<number | null>(null);

  const load = useCallback(
    async (signal: AbortSignal): Promise<Report> => {
      if (!client) {
        throw { kind: "config", message: "لم يتم ضبط عنوان الـ API في التطبيق.", retryable: false };
      }
      const settled = await client.checkHealth({ signal });
      return { ...settled, checkedAt: Date.now() };
    },
    [client],
  );

  const { data, error, state, refresh } = useApiResource<Report>(load, {
    enabled: Boolean(client),
  });

  const clearCaches = useCallback(async () => {
    await Promise.all(
      CACHE_NAMESPACES.map((namespace) =>
        createTtlCache<unknown>({
          store: deviceStore,
          namespace,
          ttlMs: OFFERS_CACHE_TTL_MS,
          maxAgeMs: CACHE_MAX_AGE_MS,
        })
          .clear()
          .catch(() => undefined),
      ),
    );
    setClearedAt(Date.now());
  }, []);

  const health = data?.data ?? null;

  return (
    <Screen
      headerTitle="حالة الخدمة"
      contentContainerStyle={styles.content}
      scroll
    >
      {state === "loading" && !data ? (
        <StateBlock kind="loading" title="جارٍ فحص الخدمة…" />
      ) : null}

      {error && !data ? (
        <StateBlock
          kind="error"
          title="لم يكتمل الفحص"
          message={error.message}
          actionLabel="إعادة الفحص"
          onAction={() => void refresh()}
        />
      ) : null}

      {health ? (
        <Card>
          <View style={styles.statusRow}>
            <Text style={[styles.statusTitle, rtl]}>
              {health.ok ? "الخدمة تعمل" : "الخدمة متاحة جزئياً"}
            </Text>
            <Badge
              label={health.status}
              tone={STATUS_TONES[health.status] ?? "neutral"}
            />
          </View>
          <DataRow label="قاعدة البيانات" value={health.database ? `${health.database.status} · ${formatNumber(health.database.latencyMs)} مللي ثانية` : "غير مُبلَّغ"} />
          <DataRow label="التخزين (R2)" value={health.storage?.status ?? "غير مُبلَّغ"} />
          {health.error ? <DataRow label="ملاحظة" value={health.error} /> : null}
          <DataRow label="آخر فحص" value={formatDateTime(new Date(data?.checkedAt ?? Date.now()).toISOString())} />
        </Card>
      ) : null}

      <Card>
        <Text style={[styles.cardLabel, rtl]}>إعداد الاتصال</Text>
        <DataRow label="عنوان الـ API" value={config.baseUrl ?? "غير مضبوط"} />
        <DataRow label="مصدر العنوان" value={SOURCE_LABELS[config.source] ?? config.source} />
        <DataRow label="مهلة الطلب" value={`${formatNumber(config.timeoutMs / 1000, { decimals: 1 })} ثانية`} />
        <Text style={[styles.hint, rtl]}>
          في التطوير يُشتق العنوان من مضيف Metro تلقائياً، لذلك يجب تشغيل خادم Next
          (npm run dev) على نفس الجهاز. للإنتاج اضبط expo.extra.apiBaseUrl أو
          EXPO_PUBLIC_API_BASE_URL.
        </Text>
      </Card>

      <Card>
        <Text style={[styles.cardLabel, rtl]}>البيانات المحفوظة على الجهاز</Text>
        <DataRow label="صلاحية العروض" value={`${formatNumber(OFFERS_CACHE_TTL_MS / 60_000)} دقيقة`} />
        <DataRow label="صلاحية الوكلاء" value={`${formatNumber(AGENTS_CACHE_TTL_MS / 60_000)} دقيقة`} />
        <DataRow label="أقصى عمر مقبول" value={`${formatNumber(CACHE_MAX_AGE_MS / 3_600_000, { decimals: 1 })} ساعة`} />
        {clearedAt ? (
          <Text style={[styles.hint, rtl]}>تم مسح النسخ المحفوظة {formatDateTime(new Date(clearedAt).toISOString())}.</Text>
        ) : null}
        <PrimaryButton label="مسح البيانات المحفوظة" onPress={() => void clearCaches()} tone="ghost" />
      </Card>

      <Text style={[styles.footer, rtl]}>
        هذا التطبيق نسخة أساس (foundation) للقراءة وطلب التواصل فقط — لا تسجيل دخول
        بعد، ولا بيانات مسافرين مخزّنة على الجهاز.
      </Text>
    </Screen>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  "app-config": "expo.extra.apiBaseUrl",
  env: "EXPO_PUBLIC_API_BASE_URL",
  packager: "مضيف Metro (تطوير)",
  unset: "غير مضبوط",
};

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  statusRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  statusTitle: { ...typography.section, color: palette.inkwell },
  cardLabel: { ...typography.label, color: palette.horizon, marginBottom: spacing.xs },
  hint: {
    ...typography.muted,
    backgroundColor: palette.low,
    borderRadius: radius.sm,
    padding: spacing.sm,
    lineHeight: 18,
  },
  footer: { ...typography.muted, textAlign: "center", marginTop: spacing.md },
});
