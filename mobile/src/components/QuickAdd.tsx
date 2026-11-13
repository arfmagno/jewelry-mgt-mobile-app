import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter, type Href } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Line } from "react-native-svg";
import { TOUCH_TARGET, useTheme } from "@/theme";
import type { IconName } from "./Button";
import { Text } from "./Text";

const ACTIONS: { label: string; hint: string; icon: IconName; href: Href; testID: string }[] = [
  { label: "Piece", hint: "Something made or in stock", icon: "diamond-outline", href: "/jewelry/edit", testID: "quick-add-piece" },
  { label: "Order", hint: "A client's job order", icon: "receipt-outline", href: "/orders/edit", testID: "quick-add-order" },
  { label: "Client", hint: "Someone you sell to", icon: "person-add-outline", href: "/clients/edit", testID: "quick-add-client" },
  { label: "Purchase", hint: "Materials you bought", icon: "cart-outline", href: "/purchases/edit", testID: "quick-add-purchase" },
];

/** The + in the middle of the tab bar, a black disc with a fine gold cross: opens a sheet to add any record from anywhere. */
export function QuickAddButton() {
  const router = useRouter();
  const { colors, radius, reduceMotion, scheme } = useTheme();
  // Ink in the light theme; a raised panel in the dark one so the disc still stands apart.
  const disc = scheme === "dark" ? colors.surfaceRaised : colors.text;
  const { bottom } = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const go = (href: Href) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <View style={styles.slot}>
      <Pressable
        testID="quick-add"
        accessibilityRole="button"
        accessibilityLabel="Add new"
        accessibilityHint="Choose a piece, order, client or purchase"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.plus, { backgroundColor: disc, borderColor: colors.gold, opacity: pressed ? 0.8 : 1 }]}
      >
        <Svg width={20} height={20} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Line x1={10} y1={1} x2={10} y2={19} stroke={colors.gold} strokeWidth={1.6} strokeLinecap="round" />
          <Line x1={1} y1={10} x2={19} y2={10} stroke={colors.gold} strokeWidth={1.6} strokeLinecap="round" />
        </Svg>
      </Pressable>

      <Modal visible={open} transparent animationType={reduceMotion ? "none" : "fade"} statusBarTranslucent navigationBarTranslucent onRequestClose={() => setOpen(false)}>
        <Pressable accessibilityLabel="Close" accessibilityRole="button" onPress={() => setOpen(false)} style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} />
        <View style={[styles.sheet, { backgroundColor: colors.background, borderRadius: radius.lg, paddingBottom: 16 + bottom }]}>
          <View style={styles.head}>
            <Text variant="heading" accessibilityRole="header" style={{ flex: 1 }}>
              Add new
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setOpen(false)} style={styles.close}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>
          <View style={styles.grid}>
            {ACTIONS.map((a) => (
              <Pressable
                key={a.label}
                testID={a.testID}
                accessibilityRole="button"
                accessibilityLabel={`New ${a.label.toLowerCase()}`}
                accessibilityHint={a.hint}
                onPress={() => go(a.href)}
                style={({ pressed }) => [
                  styles.tile,
                  { borderRadius: radius.lg, borderColor: colors.divider, backgroundColor: pressed ? colors.accentSoft : colors.surface },
                ]}
              >
                <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
                  <Ionicons name={a.icon} size={28} color={colors.accent} />
                </View>
                <Text variant="label">{a.label}</Text>
                <Text variant="caption" muted style={{ textAlign: "center" }}>
                  {a.hint}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { flex: 1, alignItems: "center", justifyContent: "center" },
  plus: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: "center",
    justifyContent: "center",
  },
  sheet: { position: "absolute", left: 8, right: 8, bottom: 8, padding: 16, gap: 12 },
  head: { flexDirection: "row", alignItems: "center" },
  close: { width: TOUCH_TARGET, height: TOUCH_TARGET, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: { flexBasis: "45%", flexGrow: 1, minHeight: 128, borderWidth: 1, padding: 12, gap: 6, alignItems: "center", justifyContent: "center" },
  icon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
});
