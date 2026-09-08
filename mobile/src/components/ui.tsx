import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { palette, radius, rtl, spacing, typography, layout } from "../theme";

/**
 * Status-bar clearance without an extra native module: Android reports the real
 * height (the app runs edge-to-edge), iOS gets a notch-sized constant. Swap for
 * react-native-safe-area-context if the app ever needs per-edge insets.
 */
export function useTopInset(): number {
  if (Platform.OS === "android") {
    const reported = StatusBar.currentHeight;
    return typeof reported === "number" && reported > 0
      ? reported
      : layout.androidStatusBarHeight;
  }
  return Platform.OS === "ios" ? 48 : spacing.md;
}

export function Screen({
  children,
  scroll = false,
  headerRight,
  headerTitle,
  contentContainerStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  headerTitle?: string;
  headerRight?: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  const top = useTopInset();
  const body = scroll ? (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.screenContent, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      alwaysBounceVertical
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.screen, styles.screenContent, contentContainerStyle]}>{children}</View>
  );

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: top + spacing.xs }]}>
        <Text style={[styles.headerTitle, rtl]} numberOfLines={1}>
          {headerTitle ?? "الرحلة"}
        </Text>
        {headerRight ? <View style={styles.headerRight}>{headerRight}</View> : null}
      </View>
      {body}
    </View>
  );
}

export function Card({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const content = <View style={[styles.card, style]}>{children}</View>;
  if (!onPress) return content;
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: palette.wash }}
      style={({ pressed }) => [styles.pressable, pressed ? styles.pressed : null]}
      accessibilityRole="button"
    >
      {content}
    </Pressable>
  );
}

export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(active) }}
      style={({ pressed }) => [
        styles.chip,
        active ? styles.chipActive : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <Text style={[styles.chipLabel, rtl, active ? styles.chipLabelActive : null]}>{label}</Text>
    </Pressable>
  );
}

export type BadgeTone = "verified" | "warn" | "error" | "neutral";

const BADGE_TONES: Record<BadgeTone, { bg: string; fg: string }> = {
  verified: { bg: palette.verifiedBg, fg: palette.verified },
  warn: { bg: palette.amber, fg: palette.gold },
  error: { bg: palette.errorBg, fg: palette.error },
  neutral: { bg: palette.low, fg: palette.slate },
};

export function Badge({ label, tone = "neutral" }: { label: string; tone?: BadgeTone }) {
  const colors = BADGE_TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.badgeLabel, rtl, { color: colors.fg }]}>{label}</Text>
    </View>
  );
}

export function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.dataRow}>
      <Text style={[styles.dataLabel, rtl]}>{label}</Text>
      <Text style={[styles.dataValue, rtl]}>{value}</Text>
    </View>
  );
}

export type StateBlockKind = "loading" | "error" | "empty" | "offline";

export function StateBlock({
  kind,
  title,
  message,
  actionLabel,
  onAction,
}: {
  kind: StateBlockKind;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.stateBlock}>
      {kind === "loading" ? (
        <ActivityIndicator color={palette.horizon} />
      ) : (
        <Text style={styles.stateEmoji} accessibilityElementsHidden>
          {kind === "error" ? "!" : kind === "offline" ? "⚠" : "—"}
        </Text>
      )}
      <Text style={[styles.stateTitle, rtl]}>{title}</Text>
      {message ? (
        <Text style={[styles.stateMessage, rtl]} accessibilityRole="text">
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <PrimaryButton label={actionLabel} onPress={onAction} compact />
      ) : null}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  busy,
  compact,
  tone = "primary",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  compact?: boolean;
  tone?: "primary" | "ghost";
}) {
  const blocked = Boolean(disabled) || Boolean(busy);
  return (
    <Pressable
      onPress={blocked ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked, busy: Boolean(busy) }}
      style={({ pressed }) => [
        styles.button,
        compact ? styles.buttonCompact : null,
        tone === "ghost" ? styles.buttonGhost : null,
        blocked ? styles.buttonDisabled : null,
        pressed && !blocked ? styles.pressed : null,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={tone === "ghost" ? palette.horizon : palette.cloud} />
      ) : (
        <Text style={[styles.buttonLabel, rtl, tone === "ghost" ? styles.buttonLabelGhost : null]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export interface FieldProps extends Omit<TextInputProps, "value" | "onChangeText"> {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  error?: string;
  hint?: string;
  multiline?: boolean;
}

export function Field({ label, value, onChangeText, error, hint, style, ...rest }: FieldProps & { style?: StyleProp<TextStyle> }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, rtl]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={[styles.input, error ? styles.inputError : null, rtl, style]}
        placeholderTextColor={palette.slate}
        accessibilityLabel={label}
        accessibilityState={{ disabled: rest.editable === false }}
        {...rest}
      />
      {error ? (
        <Text style={[styles.fieldError, rtl]} accessibilityRole="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text style={[styles.fieldHint, rtl]}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  const clamp = (next: number) => Math.max(min, Math.min(max, next));
  return (
    <View style={styles.stepper}>
      <Text style={[styles.fieldLabel, rtl]}>{label}</Text>
      <View style={styles.stepperRow}>
        <Pressable
          onPress={() => onChange(clamp(value - 1))}
          disabled={value <= min}
          accessibilityRole="button"
          accessibilityLabel={`إنقاص ${label}`}
          style={({ pressed }) => [styles.stepperButton, pressed ? styles.pressed : null, value <= min ? styles.buttonDisabled : null]}
        >
          <Text style={styles.stepperGlyph}>−</Text>
        </Pressable>
        <Text style={[styles.stepperValue, rtl]}>{value}</Text>
        <Pressable
          onPress={() => onChange(clamp(value + 1))}
          disabled={value >= max}
          accessibilityRole="button"
          accessibilityLabel={`زيادة ${label}`}
          style={({ pressed }) => [styles.stepperButton, pressed ? styles.pressed : null, value >= max ? styles.buttonDisabled : null]}
        >
          <Text style={styles.stepperGlyph}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.mist },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: palette.deep,
    minHeight: layout.headerHeight,
  },
  headerTitle: { ...typography.title, color: palette.cloud, flexShrink: 1 },
  headerRight: { marginEnd: spacing.sm },
  screen: { flex: 1 },
  screenContent: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  pressable: { borderRadius: radius.lg },
  pressed: { opacity: 0.85 },
  card: {
    backgroundColor: palette.cloud,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.outline,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: palette.cloud,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.outline,
    minHeight: layout.minTouchTarget - 8,
    justifyContent: "center",
  },
  chipActive: { backgroundColor: palette.deep, borderColor: palette.deep },
  chipLabel: { ...typography.label, color: palette.slate },
  chipLabelActive: { color: palette.cloud },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  badgeLabel: { fontSize: 11, fontWeight: "700" },
  dataRow: { flexDirection: "row-reverse", justifyContent: "space-between", gap: spacing.md },
  dataLabel: { ...typography.label, flexShrink: 0 },
  dataValue: { ...typography.body, flex: 1, textAlign: "right" },
  stateBlock: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  stateEmoji: { fontSize: 22, color: palette.slate, fontWeight: "700" },
  stateTitle: { ...typography.section, color: palette.inkwell },
  stateMessage: { ...typography.muted, textAlign: "center" },
  button: {
    minHeight: layout.minTouchTarget,
    borderRadius: radius.md,
    backgroundColor: palette.horizon,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  buttonCompact: { minHeight: 40, paddingHorizontal: spacing.md, alignSelf: "flex-start" },
  buttonGhost: { backgroundColor: palette.wash },
  buttonDisabled: { opacity: 0.5 },
  buttonLabel: { ...typography.section, color: palette.cloud },
  buttonLabelGhost: { color: palette.horizon },
  field: { gap: spacing.xs },
  fieldLabel: { ...typography.label },
  input: {
    ...typography.body,
    minHeight: layout.minTouchTarget,
    borderWidth: 1,
    borderColor: palette.outline,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: palette.cloud,
    textAlign: "right",
  },
  inputError: { borderColor: palette.error, backgroundColor: palette.errorBg },
  fieldError: { ...typography.muted, color: palette.error },
  fieldHint: { ...typography.muted },
  stepper: { gap: spacing.xs },
  stepperRow: { flexDirection: "row-reverse", alignItems: "center", gap: spacing.md },
  stepperButton: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    borderRadius: radius.md,
    backgroundColor: palette.low,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperGlyph: { fontSize: 20, color: palette.deep, fontWeight: "700" },
  stepperValue: { ...typography.price, minWidth: 40, textAlign: "center" },
});
