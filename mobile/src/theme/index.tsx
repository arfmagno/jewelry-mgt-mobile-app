import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AccessibilityInfo, Appearance, useColorScheme, useWindowDimensions } from "react-native";
import { loadAppearance, saveAppearance, type AppearancePreference } from "@/lib/preferences";
import { breakpoints, dark, fonts, light, radius, space, type Palette } from "./tokens";

export * from "./tokens";

export type { AppearancePreference };

export type Theme = {
  scheme: "light" | "dark";
  /** What the person chose in Settings: follow the phone, or always light or dark. */
  appearance: AppearancePreference;
  setAppearance: (value: AppearancePreference) => void;
  colors: Palette;
  fonts: typeof fonts;
  space: typeof space;
  radius: typeof radius;
  reduceMotion: boolean;
};

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearanceState] = useState<AppearancePreference>(loadAppearance);
  const system = useColorScheme();
  const scheme = appearance === "system" ? (system === "light" ? "light" : "dark") : appearance;

  // Tell the platform too, so alerts, pickers and the keyboard match.
  useEffect(() => {
    Appearance.setColorScheme?.(appearance === "system" ? "auto" : appearance);
  }, [appearance]);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => sub.remove();
  }, []);

  const theme = useMemo<Theme>(
    () => ({
      scheme,
      appearance,
      setAppearance: (value: AppearancePreference) => {
        saveAppearance(value);
        setAppearanceState(value);
      },
      colors: scheme === "dark" ? dark : light,
      fonts,
      space,
      radius,
      reduceMotion,
    }),
    [scheme, appearance, reduceMotion],
  );
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

/** Modal transition that respects the system "reduce motion" setting. */
export function useModalAnimation(): "slide" | "none" {
  return useTheme().reduceMotion ? "none" : "slide";
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
