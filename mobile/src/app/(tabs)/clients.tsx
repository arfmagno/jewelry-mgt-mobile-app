import Ionicons from "@expo/vector-icons/Ionicons";
import { listClientSummaries, type ClientSummary } from "@jewelry/core";
import { formatMoney, formatPhPhone } from "@jewelry/shared";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { TextField } from "@/components/fields";
import { ListToolbar } from "@/components/ListToolbar";
import { EmptyState, Screen } from "@/components/layout";
import { TabSwipe } from "@/components/TabSwipe";
import { Text } from "@/components/Text";
import { initials } from "@/features/orders/OrderRow";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { fullName } from "@/lib/format";
import { TOUCH_TARGET, useTheme } from "@/theme";

/** Clients under a letter heading, by surname. */
function byLetter(clients: ClientSummary[]) {
  const groups: { letter: string; clients: ClientSummary[] }[] = [];
  for (const c of clients) {
    const letter = c.lastName.trim()[0]?.toUpperCase() ?? "#";
    const last = groups.at(-1);
    if (last?.letter === letter) last.clients.push(c);
    else groups.push({ letter, clients: [c] });
  }
  return groups;
}

export default function ClientsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [owing, setOwing] = useState(false);
  const { data, loading } = useLiveQuery((s) => listClientSummaries(s, { search, limit: 2000 }), [search]);
  const shown = (data ?? []).filter((c) => !owing || c.balance > 0);

  const summary = [
    owing ? "Clients with a balance" : `${data?.length ?? 0} ${data?.length === 1 ? "client" : "clients"}`,
    search.trim() ? `“${search.trim()}”` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <TabSwipe tab="clients">
      <Screen testID="client-list">
        <ListToolbar
          summary={summary}
          actions={[
            {
              icon: "search",
              label: searchOpen ? "Close search" : "Search clients",
              active: searchOpen,
              testID: "toggle-client-search",
              onPress: () => {
                if (searchOpen) setSearch("");
                setSearchOpen(!searchOpen);
              },
            },
            {
              icon: "cash-outline",
              label: owing ? "Show all clients" : "Show only clients with a balance",
              active: owing,
              testID: "toggle-owing",
              onPress: () => setOwing(!owing),
            },
          ]}
        />
        {searchOpen ? (
          <TextField label="Search clients" value={search} onChangeText={setSearch} placeholder="Name or phone number" autoCorrect={false} autoFocus />
        ) : null}
        {!loading && shown.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title={search || owing ? "No matching clients" : "No clients yet"}
            body={search || owing ? undefined : "Add clients with the + below, or while creating an order."}
          />
        ) : (
          byLetter(shown).map((g) => (
            <View key={g.letter}>
              <Text variant="eyebrow" color={colors.accent} accessibilityRole="header">
                {g.letter}
              </Text>
              {g.clients.map((c) => (
                <ClientRow key={c.id} client={c} onPress={() => router.push(`/clients/${c.id}`)} />
              ))}
            </View>
          ))
        )}
      </Screen>
    </TabSwipe>
  );
}

function ClientRow({ client, onPress }: { client: ClientSummary; onPress: () => void }) {
  const { colors } = useTheme();
  const name = fullName(client);
  const orders = `${client.orders} ${client.orders === 1 ? "order" : "orders"}`;
  return (
    <Pressable
      testID={`client-${client.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${formatPhPhone(client.phone)}, ${orders}${client.balance > 0 ? `, ${formatMoney(client.balance)} to collect` : ""}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderColor: colors.divider, backgroundColor: pressed ? colors.accentSoft : "transparent" },
      ]}
    >
      <View style={[styles.avatar, { borderColor: colors.gold }]}>
        <Text variant="heading" color={colors.accent} style={{ fontSize: 18, lineHeight: 22 }}>
          {initials(name)}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="eyebrow" muted numberOfLines={1}>
          {formatPhPhone(client.phone)} · {orders}
        </Text>
        <Text variant="heading" style={{ fontSize: 19, lineHeight: 24 }}>
          {name}
        </Text>
      </View>
      {client.balance > 0 ? (
        <View style={{ alignItems: "flex-end" }}>
          <Text variant="money" style={{ fontSize: 17 }}>
            {formatMoney(client.balance)}
          </Text>
          <Text variant="eyebrow" color={colors.accent} style={{ letterSpacing: 1 }}>
            To collect
          </Text>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} accessibilityElementsHidden />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: TOUCH_TARGET + 24, flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 18, paddingHorizontal: 2, borderBottomWidth: StyleSheet.hairlineWidth },
  avatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
