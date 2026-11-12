import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AccessibilityInfo, useColorScheme, useWindowDimensions } from "react-native";
import { breakpoints, dark, fonts, light, radius, space, type Palette } from "./tokens";

export * from "./tokens";

export type Theme = {
  scheme: "light" | "dark";
  colors: Palette;
  fonts: typeof fonts;
  space: typeof space;
  radius: typeof radius;
  reduceMotion: boolean;
};

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme() === "light" ? "light" : "dark";
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => sub.remove();
  }, []);

  const theme = useMemo<Theme>(
    () => ({ scheme, colors: scheme === "dark" ? dark : light, fonts, space, radius, reduceMotion }),
    [scheme, reduceMotion],
  );
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const t = useContext(ThemeContext);
  if (!t) throw new Error("useTheme must be used inside ThemeProvider");
  return t;
}

export type Layout = {
  width: number;
  isTablet: boolean;
  isWide: boolean;
  /** Columns for card grids. */
  columns: number;
  /** Horizontal page padding. */
  gutter: number;
};

/** Responsive layout values derived from the current window size (updates on rotation/resizing). */
export function useLayout(): Layout {
  const { width, fontScale } = useWindowDimensions();
  // Large text needs more room per card, so fewer columns.
  const effective = width / Math.max(1, Math.min(fontScale, 2));
  const isTablet = width >= breakpoints.tablet;
  const isWide = width >= breakpoints.wide;
  const columns = effective >= 1100 ? 4 : effective >= 800 ? 3 : effective >= 520 ? 2 : 1;
  return { width, isTablet, isWide, columns, gutter: isTablet ? space.xl : space.lg };
}
