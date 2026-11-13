import type { JewelrySummary } from "@jewelry/core";
import { formatMoney, PIECE_TYPES } from "@jewelry/shared";
import { Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "@/theme";
import { Thumb } from "./layout";
import { Text } from "./Text";

export const pieceLabel = (j: Pick<JewelrySummary, "code" | "pieceType">) =>
  [j.code ?? "New", j.pieceType ? PIECE_TYPES.labels[j.pieceType] : null].filter(Boolean).join(" · ");

const statusOf = (item: JewelrySummary) =>
  item.availability === "in_order" ? "In an order" : item.origin === "on_hand" ? "Available" : "Made to order";

/** A small dot and spaced capitals: gold when the piece is spoken for. */
function Status({ item }: { item: JewelrySummary }) {
  const { colors } = useTheme();
  const tint = item.availability === "in_order" ? colors.accent : colors.textMuted;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tint }} />
      <Text variant="eyebrow" color={tint} style={{ letterSpacing: 1 }}>
        {statusOf(item)}
      </Text>
    </View>
  );
}

export function JewelryCard({ item, onPress }: { item: JewelrySummary; onPress: () => void }) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      testID={`jewelry-card-${item.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${pieceLabel(item)}. ${item.description}. ${statusOf(item)}. Cost ${formatMoney(item.totalCost)}`}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.accentSoft : colors.surface,
        borderColor: colors.divider,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: radius.lg,
        padding: 8,
        paddingBottom: 14,
        gap: 12,
      })}
    >
      <Thumb image={item.image} kind={item.pieceType} />
      <View style={{ gap: 6, paddingHorizontal: 6 }}>
        <Text variant="eyebrow" color={colors.accent}>
          {pieceLabel(item)}
        </Text>
        <Text variant="heading" numberOfLines={2} style={{ fontSize: 18, lineHeight: 22 }}>
          {item.description}
        </Text>
        <Text variant="money">{formatMoney(item.totalCost)}</Text>
        <Status item={item} />
      </View>
    </Pressable>
  );
}

/** Compact one-line version of the card for list view. */
export function JewelryRow({ item, onPress }: { item: JewelrySummary; onPress: () => void }) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      testID={`jewelry-row-${item.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${pieceLabel(item)}. ${item.description}. ${statusOf(item)}. Cost ${formatMoney(item.totalCost)}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 8,
        paddingRight: 14,
        borderRadius: radius.lg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.divider,
        backgroundColor: pressed ? colors.accentSoft : colors.surface,
      })}
    >
      <Thumb image={item.image} size={64} kind={item.pieceType} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="eyebrow" color={colors.accent}>
          {pieceLabel(item)}
        </Text>
        <Text variant="heading" style={{ fontSize: 18, lineHeight: 22 }}>
          {item.description}
        </Text>
        <Status item={item} />
      </View>
      <Text variant="money">{formatMoney(item.totalCost)}</Text>
    </Pressable>
  );
}
