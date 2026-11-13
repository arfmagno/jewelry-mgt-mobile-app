import { useNavigation } from "expo-router";
import { useMemo, type ReactNode } from "react";
import { PanResponder, View } from "react-native";

/** Main tabs in bar order; the centre + is not a page. */
const TABS = ["index", "orders", "clients", "more"] as const;
export type TabName = (typeof TABS)[number];

export type SwipeDirection = "next" | "previous";

/**
 * Swipe sideways to move to the neighbouring tab. A page with its own sections
 * can handle the swipe first by returning true from `onSwipe`.
 * Horizontal scrollers inside (filter chips) keep their own swipes.
 */
export function TabSwipe({ tab, onSwipe, children }: { tab: TabName; onSwipe?: (dir: SwipeDirection) => boolean; children: ReactNode }) {
  const navigation = useNavigation();
  // Pass a stable `onSwipe` (useCallback) so the responder isn't rebuilt mid-gesture.
  const responder = useMemo(
    () =>
      PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) < 60 && Math.abs(g.vx) < 0.4) return;
        const dir: SwipeDirection = g.dx < 0 ? "next" : "previous";
        if (onSwipe?.(dir)) return;
        const to = TABS[TABS.indexOf(tab) + (dir === "next" ? 1 : -1)];
        if (to) navigation.navigate(to as never);
      },
    }),
    [tab, onSwipe, navigation],
  );

  return (
    <View style={{ flex: 1 }} {...responder.panHandlers}>
      {children}
    </View>
  );
}
