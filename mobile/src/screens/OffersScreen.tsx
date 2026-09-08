import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useApi } from "../api/context";
import type { ApiError } from "../api/client";
import type { Offer } from "../api/types";
import { Badge, Card, Chip, Screen, StateBlock } from "../components/ui";
import { useApiResource } from "../hooks/useApiResource";
import { createTtlCache } from "../lib/cache";
import { CACHE_MAX_AGE_MS, OFFERS_CACHE_TTL_MS } from "../lib/config";
import {
  TRIP_TYPES,
  formatDate,
  formatNumber,
  formatPrice,
  tripTypeKeyForFilter,
  tripTypeLabel,
} from "../lib/format";
import { deviceStore } from "../lib/runtime";
import { palette, radius, rtl, spacing, typography } from "../theme";

type Filter = "all" | (typeof TRIP_TYPES)[number]["key"];

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "الكل" },
  ...TRIP_TYPES.map((t) => ({ key: t.key as Filter, label: t.label })),
];

export function OffersScreen({ onOpenOffer }: { onOpenOffer: (offer: Offer) => void }) {
  const client = useApi();
  const [filter, setFilter] = useState<Filter>("all");

  // One cache slot per filter, so a cached "الكل" list is never shown for umrah.
  const cache = useMemo(
    () =>
      createTtlCache<Offer[]>({
        store: deviceStore,
        namespace: `offers:v1:${filter}`,
        ttlMs: OFFERS_CACHE_TTL_MS,
        maxAgeMs: CACHE_MAX_AGE_MS,
      }),
    [filter],
  );

  const load = useCallback(
    async (signal: AbortSignal): Promise<Offer[]> => {
      if (!client) {
        throw { kind: "config", message: "لم يتم ضبط عنوان الـ API في التطبيق.", retryable: false } satisfies ApiError;
      }
      return client.listOffers({ type: tripTypeKeyForFilter(filter) }, { signal });
    },
    [client, filter],
  );

  const { data, error, state, isStale, refresh } = useApiResource<Offer[]>(load, {
    cache,
    enabled: Boolean(client),
    deps: [filter],
  });

  const offers = data ?? [];
  const busy = state === "loading" || state === "refreshing";

  if (state === "loading" && offers.length === 0) {
    return (
      <Screen headerTitle="عروض موثّقة">
        <StateBlock kind="loading" title="جارٍ تحميل العروض…" />
      </Screen>
    );
  }

  if (state === "error" && offers.length === 0) {
    return (
      <Screen headerTitle="عروض موثّقة">
        <StateBlock
          kind={error?.kind === "offline" ? "offline" : "error"}
          title="تعذّر تحميل العروض"
          message={error?.message ?? "حاول مرة أخرى بعد قليل."}
          actionLabel="إعادة المحاولة"
          onAction={() => void refresh()}
        />
      </Screen>
    );
  }

  return (
    <Screen
      headerTitle="عروض موثّقة"
      headerRight={
        <Pressable
          onPress={() => void refresh()}
          accessibilityRole="button"
          accessibilityLabel="تحديث العروض"
          hitSlop={8}
          style={({ pressed }) => [styles.headerAction, pressed ? { opacity: 0.6 } : null]}
        >
          <Text style={styles.headerActionLabel}>{busy ? "…" : "تحديث"}</Text>
        </Pressable>
      }
    >
      <View style={styles.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
          {FILTERS.map((item) => (
            <Chip
              key={item.key}
              label={item.label}
              active={filter === item.key}
              onPress={() => setFilter(item.key)}
            />
          ))}
        </ScrollView>
      </View>

      {isStale ? (
        <View style={styles.staleBanner}>
          <Text style={[styles.staleText, rtl]}>
            {error?.message ?? "تعذّر التحديث — هذه النسخة محفوظة على جهازك."}
          </Text>
        </View>
      ) : null}

      <FlatList
        data={offers}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={busy} onRefresh={() => void refresh()} tintColor={palette.horizon} />
        }
        ListEmptyComponent={
          <StateBlock
            kind="empty"
            title="لا توجد عروض منشورة الآن"
            message={
              filter === "all"
                ? "أول عرض يُنشر من وكيل موثّق سيظهر هنا مباشرة."
                : `لا توجد عروض ضمن تصنيف ${tripTypeLabel(filter)}.`
            }
            actionLabel={filter === "all" ? undefined : "عرض كل التصنيفات"}
            onAction={filter === "all" ? undefined : () => setFilter("all")}
          />
        }
        renderItem={({ item }) => <OfferCard offer={item} onPress={() => onOpenOffer(item)} />}
      />
    </Screen>
  );
}

function OfferCard({ offer, onPress }: { offer: Offer; onPress: () => void }) {
  return (
    <Card onPress={onPress} style={styles.offerCard}>
      {offer.heroImage ? (
        <Image
          source={{ uri: offer.heroImage }}
          style={styles.hero}
          accessibilityLabel={`صورة ${offer.title}`}
          resizeMode="cover"
        />
      ) : null}
      <View style={styles.badgeRow}>
        <Badge label={tripTypeLabel(offer.tripType)} tone="neutral" />
        {offer.isFeatured ? <Badge label="مميّز" tone="warn" /> : null}
      </View>
      <Text style={[styles.offerTitle, rtl]} numberOfLines={2}>
        {offer.title}
      </Text>
      <Text style={[styles.offerAgent, rtl]} numberOfLines={1}>
        {offer.agent?.displayName ?? "وكيل الرحلة"}
        {offer.agent?.city ? ` · ${offer.agent.city}` : ""}
      </Text>
      <Text style={[styles.offerRoute, rtl]}>
        {offer.originCity} ← {offer.destinationCity}
      </Text>
      <View style={styles.offerFooter}>
        <Text style={[styles.price, rtl]}>{formatPrice(offer.priceAmount, offer.currency, offer.priceType)}</Text>
        <Text style={[styles.meta, rtl]}>
          {offer.departureDate ? `المغادرة ${formatDate(offer.departureDate)}` : `${formatNumber(offer.durationDays ?? 0)} يوم`}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  filters: { marginHorizontal: -spacing.lg, marginBottom: spacing.xs },
  filtersRow: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  listContent: { gap: spacing.md, paddingBottom: spacing.xxl },
  offerCard: { padding: spacing.md, gap: spacing.xs },
  hero: {
    width: "100%",
    height: 150,
    borderRadius: radius.md,
    backgroundColor: palette.low,
  },
  badgeRow: { flexDirection: "row-reverse", gap: spacing.xs, flexWrap: "wrap" },
  offerTitle: { ...typography.section, color: palette.inkwell },
  offerAgent: { ...typography.muted },
  offerRoute: { ...typography.body, color: palette.deep, fontWeight: "600" },
  offerFooter: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.outline,
    paddingTop: spacing.sm,
  },
  price: { ...typography.price },
  meta: { ...typography.muted },
  staleBanner: {
    backgroundColor: palette.amber,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  staleText: { ...typography.muted, color: palette.stone },
  headerAction: { paddingHorizontal: spacing.xs },
  headerActionLabel: { color: palette.cloud, fontSize: 13, fontWeight: "700" },
});
