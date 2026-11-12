/**
 * Design tokens. Two palettes follow the system appearance:
 *  - Noir & Gold (dark)
 *  - Ivory & Gold (light)
 *
 * Every text/background pair below meets WCAG 2.2 AA (4.5:1 for text, 3:1 for
 * borders and focus indicators). The light palette uses a deeper "antique" gold
 * because bright gold on ivory would fail contrast.
 */

export type Palette = {
  background: string;
  surface: string;
  surfaceRaised: string;
  text: string;
  textMuted: string;
  accent: string;
  /** Text/icon colour placed on an `accent` background. */
  onAccent: string;
  accentSoft: string;
  border: string;
  divider: string;
  danger: string;
  onDanger: string;
  success: string;
  warning: string;
  focus: string;
  scrim: string;
};

export const dark: Palette = {
  background: "#0E0D0B",
  surface: "#181612",
  surfaceRaised: "#221F19",
  text: "#F4EFE4",
  textMuted: "#A39E93",
  accent: "#D4AF37",
  onAccent: "#0E0D0B",
  accentSoft: "#3A3020",
  border: "#6E6455",
  divider: "#2C2821",
  danger: "#F28B82",
  onDanger: "#0E0D0B",
  success: "#8FD19E",
  warning: "#F2C46D",
  focus: "#F4D77A",
  scrim: "rgba(0,0,0,0.6)",
};

export const light: Palette = {
  background: "#F7F3EA",
  surface: "#FFFDF8",
  surfaceRaised: "#FFFFFF",
  text: "#1C1A16",
  textMuted: "#5E584D",
  accent: "#7A5C14",
  onAccent: "#FFFDF8",
  accentSoft: "#EFE4C8",
  border: "#8C8577",
  divider: "#E4DCCB",
  danger: "#B3261E",
  onDanger: "#FFFFFF",
  success: "#256B37",
  warning: "#8A5A00",
  focus: "#7A5C14",
  scrim: "rgba(28,26,22,0.45)",
};

export const fonts = {
  display: "CormorantGaramond_600SemiBold",
  displayBold: "CormorantGaramond_700Bold",
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemiBold: "Inter_600SemiBold",
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 6, md: 10, lg: 16, pill: 999 } as const;

/** Minimum touch target (WCAG 2.5.8 asks for 24px; Android guidance is 48dp). */
export const TOUCH_TARGET = 48;

/** Width breakpoints in dp. */
export const breakpoints = { tablet: 600, wide: 900 } as const;
/** Readable line length cap for forms and detail pages. */
export const MAX_CONTENT_WIDTH = 760;
