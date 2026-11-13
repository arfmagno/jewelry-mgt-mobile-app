import { listMaterials } from "@jewelry/core";
import { MATERIAL_KINDS, UNITS } from "@jewelry/shared";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { IconButton } from "@/components/Button";
import { TextField } from "@/components/fields";
import { Badge, EmptyState, ListRow, Screen } from "@/components/layout";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useSettings } from "@/hooks/useSettings";
import { trim } from "@/lib/format";

export default function MaterialsScreen() {
  const router = useRouter();
  const settings = useSettings();
  const [search, setSearch] = useState("");
  const tracking = settings.materialTracking;
  const { data, loading } = useLiveQuery((s) => listMaterials(s, { search, withStock: tracking }), [search, tracking]);

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          headerRight: () => <IconButton testID="add-material" icon="add" label="New material" onPress={() => router.push("/materials/edit")} />,
        }}
      />
      <Screen>
        <TextField label="Search materials" value={search} onChangeText={setSearch} autoCorrect={false} />
        {!loading && data?.length === 0 ? (
          <EmptyState icon="layers-outline" title="No materials yet" body="Materials are what you buy: gold grain, diamonds, clasps, chains…" />
        ) : (
          (data ?? []).map((m) => (
            <ListRow
              key={m.id}
              title={m.name}
              subtitle={`${MATERIAL_KINDS.labels[m.kind]} · per ${UNITS.labels[m.unit]}`}
              trailing={
                m.stock !== null ? (
                  <Badge label={`${trim(m.stock, 3)} ${m.unit}`} tone={m.stock <= 0 ? "warning" : "neutral"} icon={m.stock <= 0 ? "alert-circle-outline" : undefined} />
                ) : undefined
              }
              onPress={() => router.push({ pathname: "/materials/edit", params: { id: m.id } })}
            />
          ))
        )}
      </Screen>
    </View>
  );
}
