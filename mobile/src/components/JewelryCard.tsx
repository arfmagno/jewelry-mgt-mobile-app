import type { JewelrySummary } from "@jewelry/core";
import { formatMoney, PIECE_TYPES } from "@jewelry/shared";
import { Pressable, View } from "react-native";
import { useTheme } from "@/theme";
import { Badge, Thumb } from "./layout";
import { Text } from "./Text";

export const pieceLabel = (j: Pick<JewelrySummary, "code" | "pieceType">) =>
  [j.code ?? "New", j.pieceType ? PIECE_TYPES.labels[j.pieceType] : null].filter(Boolean).join(" · ");

export function JewelryCard({ item, onPress }: { item: JewelrySummary; onPress: () => void }) {
  const { colors, radius } = useTheme();
  const status = item.availability === "in_order" ? "In an order" : item.origin === "on_hand" ? "Available" : "Made to order";
  return (
    <Pressable
      testID={`jewelry-card-${item.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${pieceLabel(item)}. ${item.description}. ${status}. Cost ${formatMoney(item.totalCost)}`}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.accentSoft : colors.surface,
        borderColor: colors.divider,
        borderWidth: 1,
        borderRadius: radius.lg,
        padding: 10,
        gap: 8,
      })}
    >
      <Thumb image={item.image} kind={item.pieceType} />
      <View style={{ gap: 4 }}>
        <Text variant="caption" color={colors.accent}>
          {pieceLabel(item)}
        </Text>
        <Text numberOfLines={2}>{item.description}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <Badge
            label={status}
            tone={item.availability === "in_order" ? "accent" : "neutral"}
            icon={item.availability === "in_order" ? "receipt-outline" : "cube-outline"}
          />
          <Text variant="money" style={{ fontSize: 14 }}>
            {formatMoney(item.totalCost)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

/** Compact one-line version of the card for list view. */
export function JewelryRow({ item, onPress }: { item: JewelrySummary; onPress: () => void }) {
  const { colors, radius } = useTheme();
  const status = item.availability === "in_order" ? "In an order" : item.origin === "on_hand" ? "Available" : "Made to order";
  return (
    <Pressable
      testID={`jewelry-row-${item.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${pieceLabel(item)}. ${item.description}. ${status}. Cost ${formatMoney(item.totalCost)}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 8,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.divider,
        backgroundColor: pressed ? colors.accentSoft : colors.surface,
      })}
    >
      <Thumb image={item.image} size={64} kind={item.pieceType} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="caption" color={colors.accent}>
          {pieceLabel(item)}
        </Text>
        <Text>{item.description}</Text>
        <Text variant="caption" muted>
          {status}
        </Text>
      </View>
      <Text variant="money" style={{ fontSize: 14 }}>
        {formatMoney(item.totalCost)}
      </Text>
    </Pressable>
  );
}
