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
  const { colors, reduceMotion, scheme } = useTheme();
  // Black with a gold cross in the light theme; a champagne disc with a dark cross in the dark one.
  const cross = scheme === "dark" ? colors.onInk : colors.gold;
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
        style={({ pressed }) => [styles.plus, { backgroundColor: colors.ink, borderColor: colors.gold, opacity: pressed ? 0.8 : 1 }]}
      >
        <Svg width={20} height={20} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Line x1={10} y1={1} x2={10} y2={19} stroke={cross} strokeWidth={1.6} strokeLinecap="round" />
          <Line x1={1} y1={10} x2={19} y2={10} stroke={cross} strokeWidth={1.6} strokeLinecap="round" />
        </Svg>
      </Pressable>

      <Modal visible={open} transparent animationType={reduceMotion ? "none" : "slide"} statusBarTranslucent navigationBarTranslucent onRequestClose={() => setOpen(false)}>
        <Pressable accessibilityLabel="Close" accessibilityRole="button" onPress={() => setOpen(false)} style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} />
        {/* A menu sheet: spaced-capital heading, then one line per kind of record. */}
        <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.gold, paddingBottom: 12 + bottom }]}>
          <View style={styles.head}>
            <Text variant="eyebrow" color={colors.accent} accessibilityRole="header" style={{ flex: 1 }}>
              Add new
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setOpen(false)} style={styles.close}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
          {ACTIONS.map((a, i) => (
            <Pressable
              key={a.label}
              testID={a.testID}
              accessibilityRole="button"
              accessibilityLabel={`New ${a.label.toLowerCase()}`}
              accessibilityHint={a.hint}
              onPress={() => go(a.href)}
              style={({ pressed }) => [
                styles.item,
                { borderColor: colors.divider, borderTopWidth: i ? StyleSheet.hairlineWidth : 0, backgroundColor: pressed ? colors.accentSoft : "transparent" },
              ]}
            >
              <View style={[styles.icon, { borderColor: colors.gold }]}>
                <Ionicons name={a.icon} size={20} color={colors.accent} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="heading" style={{ fontSize: 21, lineHeight: 26 }}>
                  {a.label}
                </Text>
                <Text variant="caption" muted>
                  {a.hint}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color={colors.textMuted} />
            </Pressable>
          ))}
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
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 8, borderTopWidth: 1 },
  head: { flexDirection: "row", alignItems: "center", minHeight: TOUCH_TARGET + 8 },
  close: { width: TOUCH_TARGET, height: TOUCH_TARGET, alignItems: "center", justifyContent: "center", marginRight: -12 },
  item: { minHeight: TOUCH_TARGET + 24, flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 14 },
  icon: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
