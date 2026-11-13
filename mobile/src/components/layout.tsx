import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ImageStyle,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { PieceType } from "@jewelry/shared";
import { useImageSource } from "@/hooks/useImageSource";
import { MAX_CONTENT_WIDTH, TOUCH_TARGET, useLayout, useTheme } from "@/theme";
import type { IconName } from "./Button";
import { JewelryGlyph } from "./illustrations";
import { Text } from "./Text";

/** Scrollable page, centred with a readable max width on tablets. */
export function Screen({
  children,
  footer,
  wide,
  testID,
}: {
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  testID?: string;
}) {
  const { colors, space } = useTheme();
  const { gutter } = useLayout();
  // Keep footer buttons clear of the system navigation / gesture bar.
  const { bottom } = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        testID={testID}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingHorizontal: gutter, paddingVertical: space.lg, paddingBottom: 96 }}
      >
        <View style={[styles.column, { maxWidth: wide ? undefined : MAX_CONTENT_WIDTH, gap: space.lg }]}>
          {children}
        </View>
      </ScrollView>
      {footer ? (
        <View
          style={[
            styles.footer,
            { backgroundColor: colors.surface, borderColor: colors.divider, paddingHorizontal: gutter, paddingBottom: 12 + bottom },
          ]}
        >
          <View style={[styles.column, { maxWidth: MAX_CONTENT_WIDTH, flexDirection: "row", gap: 12 }]}>{footer}</View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

/** Two columns side by side on tablets, stacked on phones. */
export function Columns({ children }: { children: ReactNode }) {
  const { isTablet } = useLayout();
  return (
    <View style={{ flexDirection: isTablet ? "row" : "column", gap: 16 }}>
      {Array.isArray(children)
        ? children.filter((c) => c !== null && c !== undefined && c !== false).map((c, i) => (
            <View key={i} style={isTablet ? { flex: 1 } : undefined}>
              {c}
            </View>
          ))
        : children}
    </View>
  );
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 12 }}>
      <View style={[styles.sectionHeader, { borderColor: colors.divider }]}>
        <Text variant="heading" style={{ flex: 1 }}>
          {title}
        </Text>
        {action}
      </View>
      {children}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { colors, radius } = useTheme();
  return (
    <View
      style={[
        { backgroundColor: colors.surface, borderRadius: radius.lg, borderColor: colors.divider, borderWidth: 1, padding: 16, gap: 8 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function ListRow({
  title,
  subtitle,
  trailing,
  icon,
  onPress,
  accessibilityLabel,
  testID,
}: {
  title: string;
  subtitle?: string | null;
  trailing?: ReactNode;
  icon?: IconName;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const { colors, radius } = useTheme();
  const content = (
    <>
      {icon ? <Ionicons name={icon} size={22} color={colors.accent} accessibilityElementsHidden /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body" numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" muted numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
      {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} accessibilityElementsHidden /> : null}
    </>
  );
  const style = [styles.row, { backgroundColor: colors.surface, borderColor: colors.divider, borderRadius: radius.md }];
  if (!onPress) return <View style={style}>{content}</View>;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? [title, subtitle].filter(Boolean).join(", ")}
      onPress={onPress}
      style={({ pressed }) => [...style, pressed && { backgroundColor: colors.accentSoft }]}
    >
      {content}
    </Pressable>
  );
}

/** Label/value pair for detail pages. */
export function Detail({ label, value }: { label: string; value: ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <View style={styles.detail} accessible>
      <Text variant="caption" muted style={{ minWidth: 120 }}>
        {label}
      </Text>
      {typeof value === "string" || typeof value === "number" ? <Text style={{ flex: 1 }}>{value}</Text> : value}
    </View>
  );
}

/** Status pill: always carries text, never colour alone. */
export function Badge({ label, tone = "neutral", icon }: { label: string; tone?: "neutral" | "accent" | "success" | "warning" | "danger"; icon?: IconName }) {
  const { colors, radius } = useTheme();
  const fg = { neutral: colors.textMuted, accent: colors.accent, success: colors.success, warning: colors.warning, danger: colors.danger }[tone];
  return (
    <View style={[styles.badge, { borderColor: fg, borderRadius: radius.pill }]}>
      {icon ? <Ionicons name={icon} size={12} color={fg} accessibilityElementsHidden /> : null}
      <Text variant="caption" color={fg} style={{ fontSize: 12 }}>
        {label}
      </Text>
    </View>
  );
}

export function EmptyState({
  icon,
  art,
  title,
  body,
  action,
}: {
  icon: IconName;
  /** Illustration shown instead of the icon. */
  art?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      {art ?? <Ionicons name={icon} size={40} color={colors.accent} accessibilityElementsHidden />}
      <Text variant="heading" align="center">
        {title}
      </Text>
      {body ? (
        <Text muted align="center">
          {body}
        </Text>
      ) : null}
      {action}
    </View>
  );
}

export function Loading() {
  const { colors } = useTheme();
  return (
    <View style={[styles.empty, { flex: 1, backgroundColor: colors.background }]} accessibilityLabel="Loading" accessibilityRole="progressbar">
      <ActivityIndicator color={colors.accent} size="large" />
    </View>
  );
}

export function Thumb({
  image,
  size,
  label,
  kind,
}: {
  image: { localUri: string | null; storageKey: string | null } | null | undefined;
  size?: number;
  label?: string;
  /** Drawn as the placeholder when there is no photo. */
  kind?: PieceType | null;
}) {
  const { colors, radius, reduceMotion } = useTheme();
  const uri = useImageSource(image);
  const box: ViewStyle & ImageStyle = size
    ? { width: size, height: size }
    : { width: "100%", aspectRatio: 1 };
  if (!uri) {
    return (
      <View
        style={[box, styles.thumbEmpty, { backgroundColor: colors.accentSoft, borderRadius: radius.md }]}
        accessibilityLabel={label ? `${label}, no photo` : undefined}
        accessible={!!label}
      >
        {kind ? (
          <JewelryGlyph type={kind} size={size ? size * 0.7 : 96} color={colors.accent} strokeWidth={size && size < 64 ? 3 : 2} />
        ) : (
          <Ionicons name="diamond-outline" size={size ? size / 2.5 : 36} color={colors.accent} />
        )}
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={[box, { borderRadius: radius.md }]}
      contentFit="cover"
      transition={reduceMotion ? 0 : 150}
      accessibilityLabel={label}
      accessible={!!label}
    />
  );
}

/** Responsive grid for cards. */
export function Grid<T>({ items, render, keyOf }: { items: T[]; render: (item: T) => ReactNode; keyOf: (item: T) => string }) {
  const { columns } = useLayout();
  return (
    <View style={styles.grid}>
      {items.map((it) => (
        <View key={keyOf(it)} style={{ width: `${100 / columns}%`, padding: 6 }}>
          {render(it)}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { width: "100%", alignSelf: "center" },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 12 },
  sectionHeader: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, paddingBottom: 6, minHeight: TOUCH_TARGET },
  row: {
    minHeight: TOUCH_TARGET + 16,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    borderWidth: 1,
  },
  detail: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingVertical: 4 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2, alignSelf: "flex-start" },
  empty: { alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -6 },
});
