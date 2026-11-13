import { listJewelry, type Availability } from "@jewelry/core";
import { COMPONENT_TYPES } from "@jewelry/shared";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/Button";
import { TextField } from "@/components/fields";
import { FilterBar } from "@/components/FilterBar";
import { JewelryGlyph } from "@/components/illustrations";
import { JewelryCard, JewelryRow } from "@/components/JewelryCard";
import { ListToolbar } from "@/components/ListToolbar";
import { TabSwipe } from "@/components/TabSwipe";
import { EmptyState, Grid, Screen } from "@/components/layout";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useTheme } from "@/theme";

type ComponentType = (typeof COMPONENT_TYPES.values)[number];
type ViewMode = "grid" | "list";
const PAGE = 60;
const AVAILABILITY = { available: "Available", in_order: "In an order" } as const;

// Remembered while the app is open.
let lastView: ViewMode = "grid";

export default function JewelryList() {
  const router = useRouter();
  const { colors } = useTheme();
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [view, setView] = useState<ViewMode>(lastView);
  const [availability, setAvailability] = useState<Availability | null>("available");
  const [type, setType] = useState<ComponentType | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const { data, loading } = useLiveQuery(
    (s) => listJewelry(s, { search, availability: availability ?? undefined, componentType: type ?? undefined, limit }),
    [search, availability, type, limit],
  );
  const filtered = Boolean(search || availability || type);
  const add = () => router.push("/jewelry/edit");
  const open = (id: string) => router.push(`/jewelry/${id}`);

  const summary = [
    availability ? AVAILABILITY[availability] : "All pieces",
    type ? COMPONENT_TYPES.labels[type] : null,
    search.trim() ? `“${search.trim()}”` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <TabSwipe tab="index">
      <Screen wide testID="jewelry-list">
        <ListToolbar
          summary={summary}
          actions={[
            {
              icon: "search",
              label: searchOpen ? "Close search" : "Search pieces",
              active: searchOpen,
              testID: "toggle-search",
              onPress: () => {
                if (searchOpen) setSearch("");
                setSearchOpen(!searchOpen);
              },
            },
            {
              icon: "options-outline",
              label: filtersOpen ? "Hide filters" : "Show filters",
              active: filtersOpen,
              count: (availability ? 1 : 0) + (type ? 1 : 0),
              testID: "toggle-filters",
              onPress: () => setFiltersOpen(!filtersOpen),
            },
            {
              icon: view === "grid" ? "list" : "grid-outline",
              label: view === "grid" ? "Show as list" : "Show as grid",
              testID: "toggle-view",
              onPress: () => {
                const next = view === "grid" ? "list" : "grid";
                lastView = next;
                setView(next);
              },
            },
          ]}
        />
        {searchOpen ? (
          <TextField label="Search pieces" value={search} onChangeText={setSearch} placeholder="Code or description" autoCorrect={false} autoFocus />
        ) : null}
        {filtersOpen ? (
          <>
            <FilterBar
              label="Availability"
              value={availability}
              onChange={setAvailability}
              filters={[
                { value: "available", label: AVAILABILITY.available },
                { value: "in_order", label: AVAILABILITY.in_order },
              ]}
            />
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
          </>
        ) : null}
        {!loading && data?.length === 0 ? (
          <EmptyState
            icon="diamond-outline"
            art={<JewelryGlyph type={type ?? "set"} size={112} strokeWidth={1.8} color={colors.accent} />}
            title={filtered ? "No matching pieces" : "No pieces yet"}
            body={filtered ? "Try a different search or filter." : "Add your first piece: what it is, its metal, stones and costs."}
            action={filtered ? undefined : <Button label="Add your first piece" icon="add" onPress={add} />}
          />
        ) : view === "grid" ? (
          <Grid minColumns={2} items={data ?? []} keyOf={(j) => j.id} render={(j) => <JewelryCard item={j} onPress={() => open(j.id)} />} />
        ) : (
          <View style={{ gap: 8 }}>
            {(data ?? []).map((j) => (
              <JewelryRow key={j.id} item={j} onPress={() => open(j.id)} />
            ))}
          </View>
        )}
        {(data?.length ?? 0) >= limit ? (
          <Button label="Show more pieces" icon="chevron-down" variant="secondary" onPress={() => setLimit((l) => l + PAGE)} />
        ) : null}
      </Screen>
    </TabSwipe>
  );
}
