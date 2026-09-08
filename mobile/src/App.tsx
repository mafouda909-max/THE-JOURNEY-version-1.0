import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";

import { ApiProvider, useApiContext } from "./api/context";
import type { Offer } from "./api/types";
import { Card, useTopInset } from "./components/ui";
import { AgentsScreen } from "./screens/AgentsScreen";
import { OfferDetailScreen } from "./screens/OfferDetailScreen";
import { OffersScreen } from "./screens/OffersScreen";
import { StatusScreen } from "./screens/StatusScreen";
import { layout, palette, radius, rtl, spacing, typography } from "./theme";

type Tab = "offers" | "agents" | "status";

const TABS: { key: Tab; label: string }[] = [
  { key: "offers", label: "العروض" },
  { key: "agents", label: "الوكلاء" },
  { key: "status", label: "الحالة" },
];

export function App() {
  return (
    <>
      <StatusBar style="light" />
      <ApiProvider>
        <Journey />
      </ApiProvider>
    </>
  );
}

export default App;

function Journey() {
  const { config } = useApiContext();
  const [tab, setTab] = useState<Tab>("offers");
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);

  if (!config.baseUrl) {
    return <UnconfiguredScreen message={config.error ?? "لم يتم ضبط عنوان الـ API."} />;
  }

  if (selectedOffer) {
    return (
      <OfferDetailScreen
        offer={selectedOffer}
        onBack={() => {
          setSelectedOffer(null);
          setTab("offers");
        }}
      />
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.scene}>
        {tab === "offers" ? (
          <OffersScreen onOpenOffer={setSelectedOffer} />
        ) : tab === "agents" ? (
          <AgentsScreen />
        ) : (
          <StatusScreen />
        )}
      </View>
      <TabBar active={tab} onChange={setTab} />
    </View>
  );
}

function TabBar({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  return (
    <View style={styles.tabBar}>
      {TABS.map((item) => {
        const isActive = item.key === active;
        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            style={({ pressed }) => [
              styles.tab,
              isActive ? styles.tabActive : null,
              pressed ? { opacity: 0.7 } : null,
            ]}
          >
            <Text style={[styles.tabLabel, rtl, isActive ? styles.tabLabelActive : null]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function UnconfiguredScreen({ message }: { message: string }) {
  const top = useTopInset();
  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: top + spacing.md }]}>
        <Text style={styles.headerTitle}>الرحلة</Text>
      </View>
      <View style={styles.unconfiguredBody}>
        <Card>
          <Text style={[styles.unconfiguredTitle, rtl]}>التطبيق غير متصل بخادم بعد</Text>
          <Text style={[styles.unconfiguredText, rtl]}>{message}</Text>
          <Text style={[styles.unconfiguredCode, rtl]}>
            {"// التطوير: شغّل خادم الويب أولاً\n"}
            {"npm run dev\n\n"}
            {"// أو حدّد العنوان صراحةً\n"}
            {"EXPO_PUBLIC_API_BASE_URL=http://192.168.1.20:3000 npx expo start"}
          </Text>
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.mist },
  scene: { flex: 1 },
  header: {
    backgroundColor: palette.deep,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    minHeight: layout.headerHeight,
    justifyContent: "center",
  },
  headerTitle: { ...typography.title, color: palette.cloud },
  tabBar: {
    flexDirection: "row-reverse",
    backgroundColor: palette.cloud,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.outline,
    paddingBottom: Platform.OS === "ios" ? spacing.md : spacing.xs,
  },
  tab: {
    flex: 1,
    minHeight: layout.tabBarHeight,
    alignItems: "center",
    justifyContent: "center",
  },
  tabActive: { backgroundColor: palette.wash },
  tabLabel: { ...typography.label, color: palette.slate },
  tabLabelActive: { color: palette.deep, fontWeight: "800" },
  unconfiguredBody: { flex: 1, padding: spacing.lg, justifyContent: "center" },
  unconfiguredTitle: { ...typography.section, color: palette.inkwell },
  unconfiguredText: { ...typography.body, color: palette.slate, lineHeight: 21 },
  unconfiguredCode: {
    ...typography.muted,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    backgroundColor: palette.low,
    borderRadius: radius.sm,
    padding: spacing.md,
    lineHeight: 19,
    writingDirection: "ltr",
    textAlign: "left",
  },
});
