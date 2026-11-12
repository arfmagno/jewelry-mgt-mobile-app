import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { SyncIndicator } from "@/components/SyncIndicator";
import { useLayout, useTheme } from "@/theme";

export default function TabsLayout() {
  const { colors, fonts } = useTheme();
  const { isTablet } = useLayout();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { fontFamily: fonts.display, color: colors.text, fontSize: 24 },
        headerShadowVisible: false,
        headerRight: () => <SyncIndicator />,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.divider, minHeight: 64 },
        tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 12 },
        tabBarLabelPosition: isTablet ? "beside-icon" : "below-icon",
        sceneStyle: { backgroundColor: colors.background },
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
          tabBarIcon: ({ color, size }) => <Ionicons name="ellipsis-horizontal" color={String(color)} size={size} />,
        }}
      />
    </Tabs>
  );
}
