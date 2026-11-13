import { useId } from "react";
import { StyleSheet } from "react-native";
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";
import { useTheme } from "@/theme";

const hidden = { accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants", pointerEvents: "none" } as const;

/** Polished-gold fill behind a button or badge: light catches the top left, shade sits bottom right. */
export function GoldFill({ radius = 0 }: { radius?: number }) {
  const { colors } = useTheme();
  const id = useId().replace(/:/g, "");
  const [hi, mid, lo] = colors.gold;
  return (
    <Svg style={StyleSheet.absoluteFill} {...hidden}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={hi} />
          <Stop offset="0.45" stopColor={mid} />
          <Stop offset="1" stopColor={lo} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" rx={radius} ry={radius} fill={`url(#${id})`} />
    </Svg>
  );
}

/** Softly lit backdrop, like a display case, for showing a piece without a photo. */
export function Stage({ radius = 0 }: { radius?: number }) {
  const { colors } = useTheme();
  const id = useId().replace(/:/g, "");
  const [centre, edge] = colors.stage;
  return (
    <Svg style={StyleSheet.absoluteFill} {...hidden}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="42%" r="70%">
          <Stop offset="0" stopColor={centre} />
          <Stop offset="1" stopColor={edge} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" rx={radius} ry={radius} fill={`url(#${id})`} />
    </Svg>
  );
}
