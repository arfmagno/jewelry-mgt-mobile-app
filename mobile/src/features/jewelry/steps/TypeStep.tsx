import Ionicons from "@expo/vector-icons/Ionicons";
import { COMPONENT_TYPES, ORIGINS, PIECE_TYPES, pieceType, type Jewelry } from "@jewelry/shared";
import { View } from "react-native";
import { JewelryGlyph } from "@/components/illustrations";
import { Text } from "@/components/Text";
import { TileMultiPicker, TilePicker } from "@/components/tiles";
import { useTheme } from "@/theme";
import { withPartTypes } from "../form";
import { StepTitle, type StepProps } from "./common";

const ORIGIN_TILES: { value: Jewelry["origin"]; caption: string; icon: "storefront-outline" | "person-outline" }[] = [
  { value: "on_hand", caption: "Made for stock, ready to sell", icon: "storefront-outline" },
  { value: "made_to_order", caption: "Made for a client's order", icon: "person-outline" },
];

export function TypeStep({ form, set, errors }: StepProps) {
  const { colors } = useTheme();
  const types = [...new Set(form.components.map((c) => c.type))];
  const kind = pieceType(form.components.map((c) => c.type));

  return (
    <>
      <StepTitle title="What are you making?" subtitle="Pick one, or several to make a set." />
      <TileMultiPicker
        label="Jewelry"
        testIDPrefix="type"
        values={types}
        error={errors.components}
        onToggle={(t) => {
          const components = withPartTypes(form, types.includes(t) ? types.filter((x) => x !== t) : [...types, t]);
          set(components.length > 1 ? { components } : { components, sameMetalForAll: true });
        }}
        tiles={COMPONENT_TYPES.values.map((t) => ({
          value: t,
          label: COMPONENT_TYPES.labels[t],
          art: (selected) => <JewelryGlyph type={t} size={56} color={selected ? colors.accent : colors.textMuted} />,
        }))}
      />
      {kind && types.length > 1 ? (
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }} accessibilityLiveRegion="polite">
          <JewelryGlyph type={kind} size={28} color={colors.accent} />
          <Text muted>Saved as a {PIECE_TYPES.labels[kind].toLowerCase()}.</Text>
        </View>
      ) : null}
      <TilePicker
        label="Who is it for?"
        value={form.origin}
        onChange={(o) => o && set({ origin: o })}
        minTileWidth={140}
        tiles={ORIGIN_TILES.map((o) => ({
          value: o.value,
          label: ORIGINS.labels[o.value],
          caption: o.caption,
          art: (selected) => <Ionicons name={o.icon} size={32} color={selected ? colors.accent : colors.textMuted} />,
        }))}
      />
    </>
  );
}
