import { Text as RNText, type TextProps, type TextStyle } from "react-native";
import { useTheme } from "@/theme";

export type TextVariant = "display" | "title" | "heading" | "body" | "label" | "caption" | "money";

type Props = TextProps & {
  variant?: TextVariant;
  muted?: boolean;
  color?: string;
  align?: TextStyle["textAlign"];
};

/**
 * Themed text. Font scaling is always on; very large display text is capped so
 * headings stay on screen at 200% system font size.
 */
export function Text({ variant = "body", muted, color, align, style, ...rest }: Props) {
  const { colors, fonts } = useTheme();
  const base: Record<TextVariant, TextStyle> = {
    display: { fontFamily: fonts.displayBold, fontSize: 34, lineHeight: 40 },
    title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32 },
    heading: { fontFamily: fonts.display, fontSize: 20, lineHeight: 26 },
    body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
    label: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 20, letterSpacing: 0.2 },
    caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
    money: { fontFamily: fonts.bodySemiBold, fontSize: 16, lineHeight: 24, fontVariant: ["tabular-nums"] },
  };
  const isHeading = variant === "display" || variant === "title" || variant === "heading";
  return (
    <RNText
      accessibilityRole={isHeading ? "header" : undefined}
      maxFontSizeMultiplier={variant === "display" ? 1.6 : 2.5}
      style={[base[variant], { color: color ?? (muted ? colors.textMuted : colors.text), textAlign: align }, style]}
      {...rest}
    />
  );
}
