import Ionicons from "@expo/vector-icons/Ionicons";
import type { OrderSummary } from "@jewelry/core";
import { formatMoney, ORDER_STATUSES } from "@jewelry/shared";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/Text";
import { TOUCH_TARGET, useTheme } from "@/theme";

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

/** One order: client, code, status, total and how much of it is paid. */
export function OrderRow({ order, onPress }: { order: OrderSummary; onPress: () => void }) {
  const { colors, radius } = useTheme();
  const paidShare = order.selling > 0 ? Math.min(1, order.paid / order.selling) : 0;
  const done = order.status === "completed";
  const paidText = order.balance > 0 ? `${formatMoney(order.balance)} to collect` : "Fully paid";

  return (
    <Pressable
      testID={`order-${order.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${order.clientName}, ${order.code ?? "order"}, ${ORDER_STATUSES.labels[order.status]}, ${order.itemCount} ${order.itemCount === 1 ? "piece" : "pieces"}, total ${formatMoney(order.selling)}, ${paidText}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderRadius: radius.lg, borderColor: colors.divider, backgroundColor: pressed ? colors.accentSoft : colors.surface },
      ]}
    >
      <View style={[styles.avatar, { borderColor: colors.gold[1], backgroundColor: colors.background }]}>
        <Text variant="heading" color={colors.accent} style={{ fontSize: 18, lineHeight: 22 }}>
          {initials(order.clientName)}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.line}>
          <Ionicons name={done ? "checkmark-circle" : "hammer-outline"} size={12} color={done ? colors.success : colors.accent} />
          <Text variant="eyebrow" muted style={{ flex: 1 }} numberOfLines={1}>
            {order.code} · {order.itemCount} {order.itemCount === 1 ? "piece" : "pieces"}
          </Text>
        </View>
        <View style={styles.line}>
          <Text variant="heading" style={{ flex: 1, fontSize: 19, lineHeight: 24 }}>
            {order.clientName}
          </Text>
          <Text variant="money">{formatMoney(order.selling)}</Text>
        </View>
        <View style={[styles.track, { backgroundColor: colors.divider }]}>
          <View style={{ width: `${paidShare * 100}%`, height: "100%", backgroundColor: order.balance > 0 ? colors.gold[1] : colors.success }} />
        </View>
        <Text variant="caption" color={order.balance > 0 ? colors.text : colors.success}>
          {paidText}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: TOUCH_TARGET + 24, flexDirection: "row", gap: 14, paddingVertical: 14, paddingHorizontal: 14, borderWidth: StyleSheet.hairlineWidth, alignItems: "center" },
  avatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  line: { flexDirection: "row", alignItems: "center", gap: 6 },
  track: { height: 2, borderRadius: 1, overflow: "hidden", marginTop: 4 },
});
