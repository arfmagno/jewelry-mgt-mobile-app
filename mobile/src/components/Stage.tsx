import { useId } from "react";
import { StyleSheet } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { useTheme } from "@/theme";

const hidden = { accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants", pointerEvents: "none" } as const;

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
