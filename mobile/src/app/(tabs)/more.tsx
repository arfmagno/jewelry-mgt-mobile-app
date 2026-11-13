import { useRouter } from "expo-router";
import { Alert } from "react-native";
import { Button } from "@/components/Button";
import { Card, Columns, Detail, ListRow, Screen, Section } from "@/components/layout";
import { TabSwipe } from "@/components/TabSwipe";
import { useSettings } from "@/hooks/useSettings";
import { useApp } from "@/providers/app";

export default function MoreScreen() {
  const router = useRouter();
  const { authState, syncStatus, online, syncNow, signOut } = useApp();
  const settings = useSettings();

  const confirmSignOut = () =>
    Alert.alert(
      "Sign out?",
      syncStatus?.pending
        ? `${syncStatus.pending} change(s) have not synced yet. They stay on this device and sync after you sign in again.`
        : "Your records stay on this device.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Sign out", style: "destructive", onPress: signOut },
      ],
    );

  return (
    <TabSwipe tab="more">
      <Screen testID="more">
        <Section title="Records">
          <Columns>
            <ListRow icon="storefront-outline" title="Suppliers" subtitle="Where materials come from" onPress={() => router.push("/suppliers")} />
            <ListRow icon="cart-outline" title="Purchases" subtitle="Materials bought and prices paid" onPress={() => router.push("/purchases")} />
          </Columns>
          <Columns>
            <ListRow
              icon="layers-outline"
              title="Materials"
              subtitle={settings.materialTracking ? "Metals, stones and findings with stock" : "Metals, stones and findings"}
              onPress={() => router.push("/materials")}
            />
            <ListRow icon="bar-chart-outline" title="Reports" subtitle="Monthly sales, cost and profit" onPress={() => router.push("/reports")} />
          </Columns>
        </Section>
        <Section title="App">
          <Columns>
            <ListRow testID="open-settings" icon="settings-outline" title="Settings" subtitle="Units, markup and stock tracking" onPress={() => router.push("/settings")} />
            <ListRow testID="open-trash" icon="trash-outline" title="Trash" subtitle="Deleted records are kept for 7 days" onPress={() => router.push("/trash")} />
          </Columns>
        </Section>
        {authState === "signed_in" ? (
          <Section title="Sync">
            <Card>
              <Detail label="Connection" value={online ? "Online" : "Offline"} />
              <Detail label="Waiting to sync" value={String(syncStatus?.pending ?? 0)} />
              <Detail label="Last synced" value={syncStatus?.lastSyncedAt ? new Date(syncStatus.lastSyncedAt).toLocaleString() : "Never"} />
              {syncStatus?.state === "error" ? <Detail label="Last error" value={syncStatus.error} /> : null}
            </Card>
            <Columns>
              <Button label="Sync now" icon="sync-outline" variant="secondary" disabled={!online} onPress={() => syncNow()} />
              <Button label="Sign out" icon="log-out-outline" variant="ghost" onPress={confirmSignOut} />
            </Columns>
          </Section>
        ) : (
          <Section title="Sync">
            <Card>
              <Detail label="Mode" value="This device only" />
            </Card>
          </Section>
        )}
      </Screen>
    </TabSwipe>
  );
}
