import { StyleSheet, View } from "react-native";
import { useTheme } from "@/theme";

/** Plain backdrop, like the floor of a display case, for showing a piece without a photo. */
export function Stage({ radius = 0 }: { radius?: number }) {
  const { colors } = useTheme();
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.stage, borderRadius: radius }]}
    />
  );
}
