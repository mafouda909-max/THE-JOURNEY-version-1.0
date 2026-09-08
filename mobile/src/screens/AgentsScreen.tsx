import { useCallback, useMemo } from "react";
import { FlatList, Image, RefreshControl, StyleSheet, Text, View } from "react-native";

import { useApi } from "../api/context";
import type { ApiError } from "../api/client";
import type { Agent } from "../api/types";
import { Badge, Card, Chip, Screen, StateBlock } from "../components/ui";
import { useApiResource } from "../hooks/useApiResource";
import { createTtlCache } from "../lib/cache";
import { AGENTS_CACHE_TTL_MS, CACHE_MAX_AGE_MS } from "../lib/config";
import { formatNumber, formatPercent, formatRating } from "../lib/format";
import { deviceStore } from "../lib/runtime";
import { palette, radius, rtl, spacing, typography } from "../theme";

export function AgentsScreen() {
  const client = useApi();

  const cache = useMemo(
    () =>
      createTtlCache<Agent[]>({
        store: deviceStore,
        namespace: "agents:v1",
        ttlMs: AGENTS_CACHE_TTL_MS,
        maxAgeMs: CACHE_MAX_AGE_MS,
      }),
    [],
  );

  const load = useCallback(
    async (signal: AbortSignal): Promise<Agent[]> => {
      if (!client) {
        throw { kind: "config", message: "لم يتم ضبط عنوان الـ API في التطبيق.", retryable: false } satisfies ApiError;
      }
      return client.listAgents({ signal });
    },
    [client],
  );

  const { data, error, state, isStale, refresh } = useApiResource<Agent[]>(load, {
    cache,
    enabled: Boolean(client),
  });

  const agents = data ?? [];
  const busy = state === "loading" || state === "refreshing";

  if (state === "loading" && agents.length === 0) {
    return (
      <Screen headerTitle="الوكلاء الموثّقون">
        <StateBlock kind="loading" title="جارٍ تحميل الوكلاء…" />
      </Screen>
    );
  }

  if (state === "error" && agents.length === 0) {
    return (
      <Screen headerTitle="الوكلاء الموثّقون">
        <StateBlock
          kind={error?.kind === "offline" ? "offline" : "error"}
          title="تعذّر تحميل الوكلاء"
          message={error?.message ?? "حاول مرة أخرى بعد قليل."}
          actionLabel="إعادة المحاولة"
          onAction={() => void refresh()}
        />
      </Screen>
    );
  }

  return (
    <Screen headerTitle="الوكلاء الموثّقون">
      <Text style={[styles.intro, rtl]}>
        كل وكيل هنا راجعت الإدارة ترخيصه قبل النشر — التقييمات من مسافرين حقيقيين فقط.
      </Text>
      <FlatList
        data={agents}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={busy} onRefresh={() => void refresh()} tintColor={palette.horizon} />
        }
        ListEmptyComponent={
          <StateBlock kind="empty" title="لا يوجد وكلاء موثّقون بعد" message="سيظهر أول وكيل معتمد هنا." />
        }
        renderItem={({ item }) => <AgentCard agent={item} stale={isStale} />}
        ListFooterComponent={
          isStale ? (
            <Text style={[styles.staleText, rtl]}>{error?.message ?? "تعذّر التحديث — البيانات المعروضة محفوظة على جهازك."}</Text>
          ) : null
        }
      />
    </Screen>
  );
}

function AgentCard({ agent, stale }: { agent: Agent; stale: boolean }) {
  return (
    <Card>
      <View style={styles.head}>
        {agent.photoUrl ? (
          <Image source={{ uri: agent.photoUrl }} style={styles.photo} resizeMode="cover" />
        ) : (
          <View style={[styles.photo, styles.photoFallback]}>
            <Text style={styles.photoGlyph}>{agent.displayName.slice(0, 1)}</Text>
          </View>
        )}
        <View style={styles.headText}>
          <Text style={[styles.name, rtl]} numberOfLines={1}>
            {agent.displayName}
          </Text>
          <Text style={[styles.location, rtl]} numberOfLines={1}>
            {agent.city} · {agent.country}
          </Text>
          <View style={styles.badgeRow}>
            <Badge
              label={agent.verificationStatus === "verified" ? "موثّق" : agent.verificationStatus}
              tone={agent.verificationStatus === "verified" ? "verified" : "warn"}
            />
            {stale ? <Badge label="بيانات محفوظة" tone="neutral" /> : null}
          </View>
        </View>
      </View>

      {agent.bio ? (
        <Text style={[styles.bio, rtl]} numberOfLines={3}>
          {agent.bio}
        </Text>
      ) : null}

      {agent.specialtyTags.length > 0 ? (
        <View style={styles.tagRow}>
          {agent.specialtyTags.slice(0, 4).map((tag) => (
            <Chip key={tag} label={tag} />
          ))}
        </View>
      ) : null}

      <View style={styles.metrics}>
        <Metric label="معدل الرد" value={formatPercent(agent.responseRate)} />
        <Metric label="زمن الرد" value={`${formatNumber(agent.avgResponseHours, { decimals: 1 })} ساعة`} />
        <Metric label="رحلات" value={formatNumber(agent.totalTrips)} />
      </View>
      <Text style={[styles.rating, rtl]}>{formatRating(agent.avgRating, agent.reviewCount)}</Text>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, rtl]}>{value}</Text>
      <Text style={[styles.metricLabel, rtl]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { ...typography.muted, marginBottom: spacing.xs },
  listContent: { gap: spacing.md, paddingBottom: spacing.xxl },
  head: { flexDirection: "row-reverse", gap: spacing.md, alignItems: "center" },
  photo: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: palette.low },
  photoFallback: { alignItems: "center", justifyContent: "center", backgroundColor: palette.wash },
  photoGlyph: { ...typography.section, color: palette.deep },
  headText: { flex: 1, gap: 2 },
  name: { ...typography.section, color: palette.inkwell },
  location: { ...typography.muted },
  badgeRow: { flexDirection: "row-reverse", gap: spacing.xs, marginTop: 2, flexWrap: "wrap" },
  bio: { ...typography.body, color: palette.slate, marginTop: spacing.xs },
  tagRow: { flexDirection: "row-reverse", gap: spacing.xs, flexWrap: "wrap", marginTop: spacing.xs },
  metrics: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.outline,
    paddingTop: spacing.sm,
  },
  metric: { alignItems: "center", flex: 1 },
  metricValue: { ...typography.price, fontSize: 15 },
  metricLabel: { ...typography.label },
  rating: { ...typography.muted },
  staleText: { ...typography.muted, color: palette.stone, marginTop: spacing.sm, textAlign: "center" },
});
