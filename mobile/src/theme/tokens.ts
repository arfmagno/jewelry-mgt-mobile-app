/**
 * Design tokens. Two palettes follow the system appearance:
 *  - Noir & Gold (dark)
 *  - Ivory & Gold (light)
 *
 * Every text/background pair below meets WCAG 2.2 AA (4.5:1 for text, 3:1 for
 * borders and focus indicators). The light palette uses a deeper "antique" gold
 * because bright gold on ivory would fail contrast.
 *
 * The look is flat and restrained: primary actions are solid ink, gold is kept
 * to type and fine lines, corners are nearly square.
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
  /** Solid fill for primary actions. */
  ink: string;
  /** Text/icon colour on `ink`. */
  onInk: string;
  /** Decorative gold for hairlines and rings (not for text). */
  gold: string;
  /** Soft backdrop behind a piece, centre to edge, like a lit display case. */
  stage: readonly [string, string];
};

export const dark: Palette = {
  // Warm espresso rather than pure black, with soft champagne gold.
  background: "#141210",
  surface: "#1C1A17",
  surfaceRaised: "#25221E",
  text: "#F2EDE4",
  textMuted: "#A8A196",
  accent: "#CDB27A",
  onAccent: "#141210",
  accentSoft: "#2A251D",
  border: "#776E61",
  divider: "#2E2A25",
  danger: "#F28B82",
  onDanger: "#141210",
  success: "#8FD19E",
  warning: "#F2C46D",
  focus: "#E6CF95",
  scrim: "rgba(0,0,0,0.6)",
  ink: "#CDB27A",
  onInk: "#141210",
  gold: "#8C7748",
  stage: ["#3A352E", "#1D1A17"],
};

export const light: Palette = {
  background: "#FAF8F3",
  surface: "#FFFFFF",
  surfaceRaised: "#FFFFFF",
  text: "#17150F",
  textMuted: "#5F594E",
  accent: "#80631B",
  onAccent: "#FFFFFF",
  accentSoft: "#F2ECDF",
  border: "#8C8577",
  divider: "#E8E1D3",
  danger: "#B3261E",
  onDanger: "#FFFFFF",
  success: "#256B37",
  warning: "#8A5A00",
  focus: "#80631B",
  scrim: "rgba(23,21,15,0.45)",
  ink: "#17150F",
  onInk: "#FAF8F3",
  gold: "#B8933A",
  stage: ["#FFFFFF", "#F1EBDD"],
};

export const fonts = {
  display: "CormorantGaramond_600SemiBold",
  displayBold: "CormorantGaramond_700Bold",
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemiBold: "Inter_600SemiBold",
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 2, md: 4, lg: 6, pill: 999 } as const;

/** Minimum touch target (WCAG 2.5.8 asks for 24px; Android guidance is 48dp). */
export const TOUCH_TARGET = 48;

/** Width breakpoints in dp. */
export const breakpoints = { tablet: 600, wide: 900 } as const;
/** Readable line length cap for forms and detail pages. */
export const MAX_CONTENT_WIDTH = 760;
