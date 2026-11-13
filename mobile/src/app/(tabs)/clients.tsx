import { listClients } from "@jewelry/core";
import { formatPhPhone } from "@jewelry/shared";
import { useRouter } from "expo-router";
import { useState } from "react";
import { TextField } from "@/components/fields";
import { EmptyState, ListRow, Screen } from "@/components/layout";
import { TabSwipe } from "@/components/TabSwipe";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { fullName } from "@/lib/format";

export default function ClientsScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const { data, loading } = useLiveQuery((s) => listClients(s, { search, limit: 500 }), [search]);

  return (
    <TabSwipe tab="clients">
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
    </TabSwipe>
  );
}
