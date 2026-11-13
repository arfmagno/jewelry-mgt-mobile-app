// Per-weight imports so only the faces in use are bundled.
import { CormorantGaramond_600SemiBold } from "@expo-google-fonts/cormorant-garamond/600SemiBold";
import { CormorantGaramond_700Bold } from "@expo-google-fonts/cormorant-garamond/700Bold";
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import type { Store } from "@jewelry/core";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Text } from "@/components/Text";
import { openStore } from "@/lib/db";
import { AppProvider, useApp } from "@/providers/app";
import { ThemeProvider, useTheme } from "@/theme";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    CormorantGaramond_600SemiBold,
    CormorantGaramond_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });
  const [store, setStore] = useState<Store | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    openStore().then(setStore, (e: unknown) => setDbError(String(e)));
  }, []);

  const ready = (fontsLoaded || fontError) && (store || dbError);
  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        {store ? (
          <AppProvider store={store}>
            <Navigator />
          </AppProvider>
        ) : (
          <Fatal message={dbError ?? "Unknown error"} />
        )}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function Navigator() {
  const { colors, scheme } = useTheme();
  const { authState } = useApp();

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => undefined);
  }, [colors.background]);

  if (authState === "loading") return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  const canUseApp = authState === "signed_in" || authState === "local_only";

  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          // Small spaced capitals: the page itself carries the large title.
          headerTitle: ({ children }) => (
            <Text variant="eyebrow" style={{ fontSize: 12 }} numberOfLines={1}>
              {children}
            </Text>
          ),
          headerTitleAlign: "center",
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
          headerBackButtonDisplayMode: "minimal",
        }}
      >
        <Stack.Protected guard={canUseApp}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="jewelry/[id]" options={{ title: "Piece" }} />
          <Stack.Screen name="jewelry/edit" options={{ title: "Piece", presentation: "modal" }} />
          <Stack.Screen name="orders/[id]" options={{ title: "Job order" }} />
          <Stack.Screen name="orders/edit" options={{ title: "Job order", presentation: "modal" }} />
          <Stack.Screen name="orders/assistant" options={{ title: "Describe an order", presentation: "modal" }} />
          <Stack.Screen name="clients/[id]" options={{ title: "Client" }} />
          <Stack.Screen name="clients/edit" options={{ title: "Client", presentation: "modal" }} />
          <Stack.Screen name="suppliers/index" options={{ title: "Suppliers" }} />
          <Stack.Screen name="suppliers/edit" options={{ title: "Supplier", presentation: "modal" }} />
          <Stack.Screen name="materials/index" options={{ title: "Materials" }} />
          <Stack.Screen name="materials/edit" options={{ title: "Material", presentation: "modal" }} />
          <Stack.Screen name="purchases/index" options={{ title: "Purchases" }} />
          <Stack.Screen name="purchases/edit" options={{ title: "Purchase", presentation: "modal" }} />
          <Stack.Screen name="reports" options={{ title: "Reports" }} />
          <Stack.Screen name="trash" options={{ title: "Trash" }} />
          <Stack.Screen name="settings" options={{ title: "Settings" }} />
        </Stack.Protected>
        <Stack.Protected guard={!canUseApp}>
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}

function Fatal({ message }: { message: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 24, justifyContent: "center", gap: 12 }}>
      <Text variant="title">The local database could not be opened</Text>
      <Text muted>{message}</Text>
    </View>
  );
}
