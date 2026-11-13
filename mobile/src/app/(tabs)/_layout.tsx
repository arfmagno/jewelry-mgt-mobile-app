import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/providers/app";
import { useLayout, useTheme } from "@/theme";

export default function TabsLayout() {
  const { colors, fonts } = useTheme();
  const { isTablet } = useLayout();
  const { top } = useSafeAreaInsets();
  const { syncStatus } = useApp();
  return (
    <Tabs
      screenOptions={{
        // The tab bar already says where you are; the space goes to the list.
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.divider, minHeight: 64 },
        tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 12 },
        tabBarLabelPosition: isTablet ? "beside-icon" : "below-icon",
        sceneStyle: { backgroundColor: colors.background, paddingTop: top },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Pieces",
          tabBarIcon: ({ color, size }) => <Ionicons name="diamond-outline" color={String(color)} size={size} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" color={String(color)} size={size} />,
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: "Clients",
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" color={String(color)} size={size} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          // Sync details live on More; flag a problem there.
          tabBarBadge: syncStatus?.state === "error" ? "!" : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.warning, color: colors.background },
          tabBarAccessibilityLabel: syncStatus?.state === "error" ? "More, sync issue" : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name="ellipsis-horizontal" color={String(color)} size={size} />,
        }}
      />
    </Tabs>
  );
}
