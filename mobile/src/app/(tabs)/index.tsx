import { listJewelry, type Availability } from "@jewelry/core";
import { COMPONENT_TYPES } from "@jewelry/shared";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Fab } from "@/components/Button";
import { ChoiceChips, optionsOf, TextField } from "@/components/fields";
import { JewelryCard } from "@/components/JewelryCard";
import { EmptyState, Grid, Screen } from "@/components/layout";
import { useLiveQuery } from "@/hooks/useLiveQuery";

type ComponentType = (typeof COMPONENT_TYPES.values)[number];

export default function JewelryList() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [type, setType] = useState<ComponentType | null>(null);
  const { data, loading } = useLiveQuery(
    (s) => listJewelry(s, { search, availability: availability ?? undefined, componentType: type ?? undefined, limit: 200 }),
    [search, availability, type],
  );
  const filtered = Boolean(search || availability || type);

  return (
    <View style={{ flex: 1 }}>
      <Screen wide testID="jewelry-list">
        <TextField label="Search pieces" value={search} onChangeText={setSearch} placeholder="Code or description" autoCorrect={false} />
        <ChoiceChips
          label="Availability"
          allowClear
          value={availability}
          onChange={setAvailability}
          options={[
            { value: "available", label: "Available" },
            { value: "in_order", label: "In an order" },
          ]}
        />
        <ChoiceChips label="Contains" allowClear value={type} onChange={setType} options={optionsOf(COMPONENT_TYPES)} />
        {!loading && data?.length === 0 ? (
          <EmptyState
            icon="diamond-outline"
            title={filtered ? "No matching pieces" : "No pieces yet"}
            body={filtered ? "Try a different search or filter." : "Add your first piece: its parts, stones, costs and photos."}
          />
        ) : (
          <Grid items={data ?? []} keyOf={(j) => j.id} render={(j) => <JewelryCard item={j} onPress={() => router.push(`/jewelry/${j.id}`)} />} />
        )}
      </Screen>
      <Fab testID="add-piece" label="New piece" onPress={() => router.push("/jewelry/edit")} />
    </View>
  );
}
