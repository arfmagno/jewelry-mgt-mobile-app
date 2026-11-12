import { listClients } from "@jewelry/core";
import { formatPhPhone } from "@jewelry/shared";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Fab } from "@/components/Button";
import { TextField } from "@/components/fields";
import { EmptyState, ListRow, Screen } from "@/components/layout";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { fullName } from "@/lib/format";

export default function ClientsScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const { data, loading } = useLiveQuery((s) => listClients(s, { search, limit: 500 }), [search]);

  return (
    <View style={{ flex: 1 }}>
      <Screen testID="client-list">
        <TextField label="Search clients" value={search} onChangeText={setSearch} placeholder="Name or phone number" autoCorrect={false} />
        {!loading && data?.length === 0 ? (
          <EmptyState icon="people-outline" title={search ? "No matching clients" : "No clients yet"} body={search ? undefined : "Clients you add appear here."} />
        ) : (
          (data ?? []).map((c) => (
            <ListRow
              key={c.id}
              testID={`client-${c.id}`}
              icon="person-outline"
              title={fullName(c)}
              subtitle={formatPhPhone(c.phone)}
              onPress={() => router.push(`/clients/${c.id}`)}
            />
          ))
        )}
      </Screen>
      <Fab testID="add-client" label="New client" onPress={() => router.push("/clients/edit")} />
    </View>
  );
}
