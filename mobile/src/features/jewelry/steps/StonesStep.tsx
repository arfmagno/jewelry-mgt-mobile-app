import { formatMoney, parseMoney, STONE_SETTINGS, STONE_SHAPES, type JewelryStone } from "@jewelry/shared";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Button, IconButton } from "@/components/Button";
import { FieldChrome, MoneyField, NumberField, optionsOf, SelectField, TextField } from "@/components/fields";
import { STONE_TINTS, StoneShapeGlyph } from "@/components/illustrations";
import { Card, Columns } from "@/components/layout";
import { Text } from "@/components/Text";
import { CountField, TilePicker } from "@/components/tiles";
import { SupplierField } from "@/features/suppliers/SupplierField";
import { parseNumber } from "@/lib/forms";
import { TOUCH_TARGET, useTheme } from "@/theme";
import { emptyStone, type ComponentForm, type FormErrors, type StoneForm } from "../form";
import { PartHeader, StepTitle, type StepProps } from "./common";

const KIND_TILES: { value: JewelryStone["stoneKind"]; label: string; caption?: string }[] = [
  { value: "natural_diamond", label: "Diamond", caption: "Natural" },
  { value: "lab_grown_diamond", label: "Diamond", caption: "Lab-grown" },
  { value: "moissanite", label: "Moissanite" },
  { value: "cubic_zirconia", label: "Cubic zirconia", caption: "Russian diamond" },
  { value: "gemstone", label: "Gemstone", caption: "Ruby, sapphire…" },
  { value: "other", label: "Other" },
];

const DIAMOND_LIKE: JewelryStone["stoneKind"][] = ["natural_diamond", "lab_grown_diamond", "moissanite"];

const stoneCount = (s: StoneForm) => parseNumber(s.quantity) ?? 0;
const stoneTotal = (s: StoneForm) => stoneCount(s) * (parseMoney(s.unitCost) ?? 0);

export function StonesStep({ form, set, errors }: StepProps) {
  const update = (part: ComponentForm, patch: Partial<ComponentForm>) =>
    set({ components: form.components.map((x) => (x.key === part.key ? { ...x, ...patch } : x)) });

  return (
    <>
      <StepTitle title="Stones" subtitle="Add the stones set on each part. No stones? Just continue." />
      {form.components.map((part, i) => {
        const count = part.stones.reduce((n, s) => n + stoneCount(s), 0);
        const total = part.stones.reduce((n, s) => n + stoneTotal(s), 0);
        return (
          <Card key={part.key} style={{ gap: 16 }}>
            <PartHeader
              type={part.type}
              count={count ? `${count} ${count === 1 ? "stone" : "stones"}${total ? ` · ${formatMoney(total)}` : ""}` : "No stones"}
            />
            {part.stones.map((s, k) => (
              <StoneCard
                key={s.key}
                stone={s}
                number={k + 1}
                prefix={`components.${i}.stones.${k}.`}
                errors={errors}
                onChange={(patch) => update(part, { stones: part.stones.map((x) => (x.key === s.key ? { ...x, ...patch } : x)) })}
                onRemove={() => update(part, { stones: part.stones.filter((x) => x.key !== s.key) })}
              />
            ))}
            <Button
              testID={`add-stone-${i}`}
              label={part.stones.length ? "Add another stone" : "Add stones"}
              icon="add"
              variant="secondary"
              onPress={() => update(part, { stones: [...part.stones, emptyStone()] })}
            />
          </Card>
        );
      })}
    </>
  );
}

function StoneCard({
  stone,
  number,
  prefix,
  errors,
  onChange,
  onRemove,
}: {
  stone: StoneForm;
  number: number;
  prefix: string;
  errors: FormErrors;
  onChange: (patch: Partial<StoneForm>) => void;
  onRemove: () => void;
}) {
  const { colors, radius } = useTheme();
  const [more, setMore] = useState(Boolean(stone.totalCarat || stone.colorGrade || stone.setting || stone.supplierId));
  const tint = STONE_TINTS[stone.stoneKind];
  const count = Math.max(1, Math.round(stoneCount(stone)) || 1);
  const unit = parseMoney(stone.unitCost);

  return (
    <View style={{ gap: 16, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.background }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <StoneShapeGlyph shape={stone.shape ?? "round"} size={28} color={colors.accent} fill={tint} />
        <Text variant="label" style={{ flex: 1 }}>
          Stone {number}
        </Text>
        <IconButton icon="trash-outline" label={`Remove stone ${number}`} onPress={onRemove} />
      </View>

      <TilePicker
        label="Stone"
        value={stone.stoneKind}
        minTileWidth={92}
        onChange={(stoneKind) => stoneKind && onChange({ stoneKind })}
        tiles={KIND_TILES.map((k) => ({
          ...k,
          art: () => <StoneShapeGlyph shape="round" size={32} color={colors.accent} fill={STONE_TINTS[k.value]} />,
        }))}
      />
      {stone.stoneKind === "gemstone" || stone.stoneKind === "other" ? (
        <TextField
          label={stone.stoneKind === "gemstone" ? "Which gemstone?" : "Which stone?"}
          placeholder="e.g. Ruby, Sapphire, Pearl"
          value={stone.gemName}
          onChangeText={(gemName) => onChange({ gemName })}
          maxLength={40}
        />
      ) : null}

      <ShapePicker value={stone.shape} fill={tint} onChange={(shape) => onChange({ shape })} />

      <Columns>
        <CountField label="How many" value={count} onChange={(n) => onChange({ quantity: String(n) })} />
        <NumberField label="Size" suffix="mm" value={stone.sizeMm} onChangeText={(sizeMm) => onChange({ sizeMm })} error={errors[`${prefix}sizeMm`]} />
      </Columns>

      <MoneyField
        label="Price per stone"
        value={stone.unitCost}
        onChangeText={(unitCost) => onChange({ unitCost })}
        error={errors[`${prefix}unitCost`]}
      />
      {unit ? (
        <Text variant="money" align="right" accessibilityLabel={`${count} stones cost ${formatMoney(count * unit)}`}>
          {count} × {formatMoney(unit)} = {formatMoney(count * unit)}
        </Text>
      ) : null}

      {more ? (
        <>
          <Columns>
            <NumberField label="Total carat" suffix="ct" hint="All stones in this row" value={stone.totalCarat} onChangeText={(totalCarat) => onChange({ totalCarat })} error={errors[`${prefix}totalCarat`]} />
            {DIAMOND_LIKE.includes(stone.stoneKind) ? (
              <TextField label="Colour grade" placeholder="e.g. G" value={stone.colorGrade} onChangeText={(colorGrade) => onChange({ colorGrade })} maxLength={10} autoCapitalize="characters" />
            ) : null}
          </Columns>
          <SelectField label="Setting" options={optionsOf(STONE_SETTINGS)} value={stone.setting} allowClear onChange={(setting) => onChange({ setting })} />
          <SupplierField value={stone.supplierId} onChange={(supplierId) => onChange({ supplierId })} />
        </>
      ) : (
        <Button label="More details" hint="Carat, colour grade, setting and supplier" icon="chevron-down" variant="ghost" onPress={() => setMore(true)} style={{ alignSelf: "flex-start" }} />
      )}
    </View>
  );
}

/** Stone cuts as a scrollable row of drawings. */
function ShapePicker({ value, fill, onChange }: { value: JewelryStone["shape"]; fill: string; onChange: (s: JewelryStone["shape"]) => void }) {
  const { colors, radius } = useTheme();
  return (
    <FieldChrome label="Shape">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="radiogroup" accessibilityLabel="Shape" contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
        {STONE_SHAPES.values.map((shape) => {
          const selected = shape === value;
          return (
            <Pressable
              key={shape}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={STONE_SHAPES.labels[shape]}
              onPress={() => onChange(selected ? null : shape)}
              style={{
                width: 76,
                minHeight: TOUCH_TARGET + 40,
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                padding: 6,
                borderRadius: radius.md,
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? colors.accent : colors.divider,
                backgroundColor: selected ? colors.accentSoft : colors.surface,
              }}
            >
              <StoneShapeGlyph shape={shape} size={36} color={colors.accent} fill={fill} />
              <Text variant="caption" align="center" color={selected ? colors.text : colors.textMuted}>
                {STONE_SHAPES.labels[shape]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </FieldChrome>
  );
}
