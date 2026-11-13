import { listSuppliers } from "@jewelry/core";
import { formatPhPhone } from "@jewelry/shared";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { IconButton } from "@/components/Button";
import { TextField } from "@/components/fields";
import { EmptyState, ListRow, Screen } from "@/components/layout";
import { useLiveQuery } from "@/hooks/useLiveQuery";

export default function SuppliersScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const { data, loading } = useLiveQuery((s) => listSuppliers(s, { search, limit: 500 }), [search]);
  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          headerRight: () => <IconButton testID="add-supplier" icon="add" label="New supplier" onPress={() => router.push("/suppliers/edit")} />,
        }}
      />
      <Screen>
        <TextField label="Search suppliers" value={search} onChangeText={setSearch} autoCorrect={false} />
        {!loading && data?.length === 0 ? (
          <EmptyState icon="storefront-outline" title={search ? "No matching suppliers" : "No suppliers yet"} body="Suppliers are where you buy metal, stones and findings." />
        ) : (
          (data ?? []).map((s) => (
            <ListRow
              key={s.id}
              icon="storefront-outline"
              title={s.name}
              subtitle={formatPhPhone(s.phone)}
              onPress={() => router.push({ pathname: "/suppliers/edit", params: { id: s.id } })}
            />
          ))
        )}
      </Screen>
    </View>
  );
}
