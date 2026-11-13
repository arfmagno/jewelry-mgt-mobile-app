import { listJewelry, type Availability } from "@jewelry/core";
import { COMPONENT_TYPES } from "@jewelry/shared";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Button, Fab } from "@/components/Button";
import { TextField } from "@/components/fields";
import { FilterBar } from "@/components/FilterBar";
import { JewelryGlyph } from "@/components/illustrations";
import { JewelryCard } from "@/components/JewelryCard";
import { EmptyState, Grid, Screen } from "@/components/layout";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useTheme } from "@/theme";

type ComponentType = (typeof COMPONENT_TYPES.values)[number];

export default function JewelryList() {
  const router = useRouter();
  const { colors } = useTheme();
  const [search, setSearch] = useState("");
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [type, setType] = useState<ComponentType | null>(null);
  const { data, loading } = useLiveQuery(
    (s) => listJewelry(s, { search, availability: availability ?? undefined, componentType: type ?? undefined, limit: 200 }),
    [search, availability, type],
  );
  const filtered = Boolean(search || availability || type);
  const add = () => router.push("/jewelry/edit");

  return (
    <View style={{ flex: 1 }}>
      <Screen wide testID="jewelry-list">
        <TextField label="Search pieces" value={search} onChangeText={setSearch} placeholder="Code or description" autoCorrect={false} />
        <FilterBar
          label="Type"
          value={type}
          onChange={setType}
          filters={COMPONENT_TYPES.values.map((t) => ({
            value: t,
            label: COMPONENT_TYPES.labels[t],
            art: (selected) => <JewelryGlyph type={t} size={28} strokeWidth={3} color={selected ? colors.onAccent : colors.accent} />,
          }))}
        />
        <FilterBar
          label="Availability"
          value={availability}
          onChange={setAvailability}
          filters={[
            { value: "available", label: "Available" },
            { value: "in_order", label: "In an order" },
          ]}
        />
        {!loading && data?.length === 0 ? (
          <EmptyState
            icon="diamond-outline"
            art={<JewelryGlyph type={type ?? "set"} size={112} strokeWidth={1.8} color={colors.accent} />}
            title={filtered ? "No matching pieces" : "No pieces yet"}
            body={filtered ? "Try a different search or filter." : "Add your first piece: what it is, its metal, stones and costs."}
            action={filtered ? undefined : <Button label="Add your first piece" icon="add" onPress={add} />}
          />
        ) : (
          <Grid items={data ?? []} keyOf={(j) => j.id} render={(j) => <JewelryCard item={j} onPress={() => router.push(`/jewelry/${j.id}`)} />} />
        )}
      </Screen>
      <Fab testID="add-piece" label="New piece" onPress={add} />
    </View>
  );
}
