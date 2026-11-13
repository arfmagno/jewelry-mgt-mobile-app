import { Text as RNText, type TextProps, type TextStyle } from "react-native";
import { useTheme } from "@/theme";

export type TextVariant = "display" | "title" | "heading" | "body" | "label" | "caption" | "eyebrow" | "money";

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
    // The serif's default figures are old-style ("ı8K"); lining figures read better in sizes and karats.
    display: { fontFamily: fonts.displayBold, fontSize: 34, lineHeight: 40, fontVariant: ["lining-nums"] },
    title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, fontVariant: ["lining-nums"] },
    heading: { fontFamily: fonts.display, fontSize: 20, lineHeight: 26, fontVariant: ["lining-nums"] },
    body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
    label: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 20, letterSpacing: 0.2 },
    caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
    /** Small spaced capitals for codes and labels above a title. */
    eyebrow: { fontFamily: fonts.bodyMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.4, textTransform: "uppercase" },
    /** Prices in the display serif, like a jeweller's tag. */
    money: { fontFamily: fonts.displayBold, fontSize: 19, lineHeight: 24, fontVariant: ["lining-nums", "tabular-nums"] },
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
