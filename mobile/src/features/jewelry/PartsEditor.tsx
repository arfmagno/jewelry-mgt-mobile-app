import {
  BRACELET_STYLES,
  CHAIN_STYLES,
  COMPONENT_TYPES,
  EARRING_BACKS,
  STONE_KINDS,
  STONE_SETTINGS,
  STONE_SHAPES,
  type Settings,
} from "@jewelry/shared";
import { View } from "react-native";
import { Button, IconButton } from "@/components/Button";
import { ChoiceChips, MoneyField, NumberField, optionsOf, SelectField, TextField } from "@/components/fields";
import { Card, Columns } from "@/components/layout";
import { Text } from "@/components/Text";
import { SupplierField } from "@/features/suppliers/SupplierField";
import { useTheme } from "@/theme";
import { emptyStone, FIELDS_BY_TYPE, type ComponentForm, type FormErrors, type StoneForm } from "./form";
import { MetalFields } from "./MetalFields";
import { RingSizeField } from "./RingSizeField";

type Props = {
  index: number;
  part: ComponentForm;
  ownMetal: boolean;
  units: Pick<Settings, "lengthUnit" | "ringSizeSystem">;
  errors: FormErrors;
  onChange: (patch: Partial<ComponentForm>) => void;
  onRemove: (() => void) | null;
};

export function PartEditor({ index, part, ownMetal, units, errors, onChange, onRemove }: Props) {
  const applies = FIELDS_BY_TYPE[part.type];
  const p = `components.${index}.`;
  const updateStone = (key: string, patch: Partial<StoneForm>) =>
    onChange({ stones: part.stones.map((s) => (s.key === key ? { ...s, ...patch } : s)) });

  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text variant="heading" style={{ flex: 1 }}>
          Part {index + 1}: {COMPONENT_TYPES.labels[part.type]}
        </Text>
        {onRemove ? <IconButton icon="trash-outline" label={`Remove part ${index + 1}`} onPress={onRemove} /> : null}
      </View>
      <ChoiceChips label="Type" options={optionsOf(COMPONENT_TYPES)} value={part.type} onChange={(type) => type && onChange({ type, style: null })} />

      {ownMetal ? <MetalFields value={part} onChange={onChange} errors={errors} errorPrefix={p} /> : null}

      <Columns>
        {applies.ringSize ? (
          <RingSizeField system={units.ringSizeSystem} value={part.ringSize} onChange={(ringSize) => onChange({ ringSize })} error={errors[`${p}ringSize`]} />
        ) : null}
        {applies.length ? (
          <NumberField
            label={part.type === "pendant" || part.type === "earrings" ? "Drop length" : "Length"}
            suffix={units.lengthUnit}
            value={part.length}
            onChangeText={(length) => onChange({ length })}
            error={errors[`${p}length`]}
          />
        ) : null}
        {applies.width ? (
          <NumberField label="Width" suffix="mm" value={part.widthMm} onChangeText={(widthMm) => onChange({ widthMm })} error={errors[`${p}widthMm`]} />
        ) : null}
      </Columns>
      {applies.earringBack ? (
        <SelectField label="Earring back" options={optionsOf(EARRING_BACKS)} value={part.earringBack} allowClear onChange={(earringBack) => onChange({ earringBack })} />
      ) : null}
      {applies.style ? (
        <SelectField
          label={applies.style === "chain" ? "Chain style" : "Bracelet style"}
          options={optionsOf<string>(applies.style === "chain" ? CHAIN_STYLES : BRACELET_STYLES)}
          value={part.style}
          allowClear
          onChange={(style) => onChange({ style: style as ComponentForm["style"] })}
        />
      ) : null}

      <View style={{ gap: 12, marginTop: 8 }}>
        <Text variant="label">Stones on this part</Text>
        {part.stones.map((s, k) => (
          <StoneEditor
            key={s.key}
            stone={s}
            number={k + 1}
            errors={errors}
            errorPrefix={`${p}stones.${k}.`}
            onChange={(patch) => updateStone(s.key, patch)}
            onRemove={() => onChange({ stones: part.stones.filter((x) => x.key !== s.key) })}
          />
        ))}
        <Button label="Add stone" icon="add" variant="secondary" onPress={() => onChange({ stones: [...part.stones, emptyStone()] })} />
      </View>

      <TextField label="Part notes" value={part.notes} onChangeText={(notes) => onChange({ notes })} multiline />
    </Card>
  );
}

function StoneEditor({
  stone,
  number,
  errors,
  errorPrefix,
  onChange,
  onRemove,
}: {
  stone: StoneForm;
  number: number;
  errors: FormErrors;
  errorPrefix: string;
  onChange: (patch: Partial<StoneForm>) => void;
  onRemove: () => void;
}) {
  const { colors } = useTheme();
  const isDiamond = stone.stoneKind === "natural_diamond" || stone.stoneKind === "lab_grown_diamond" || stone.stoneKind === "moissanite";
  return (
    <View style={{ gap: 12, paddingLeft: 12, borderLeftWidth: 2, borderColor: colors.accentSoft }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text variant="label" style={{ flex: 1 }}>
          Stone {number}
        </Text>
        <IconButton icon="close" label={`Remove stone ${number}`} onPress={onRemove} />
      </View>
      <Columns>
        <SelectField label="Stone" options={optionsOf(STONE_KINDS)} value={stone.stoneKind} onChange={(v) => v && onChange({ stoneKind: v })} />
        <SelectField label="Shape" options={optionsOf(STONE_SHAPES)} value={stone.shape} allowClear onChange={(shape) => onChange({ shape })} />
      </Columns>
      {stone.stoneKind === "gemstone" || stone.stoneKind === "other" ? (
        <TextField label="Gem name" placeholder="e.g. Ruby, Sapphire" value={stone.gemName} onChangeText={(gemName) => onChange({ gemName })} maxLength={40} />
      ) : null}
      <Columns>
        <NumberField label="Count" decimal={false} value={stone.quantity} onChangeText={(quantity) => onChange({ quantity })} error={errors[`${errorPrefix}quantity`]} required />
        <NumberField label="Size" suffix="mm" value={stone.sizeMm} onChangeText={(sizeMm) => onChange({ sizeMm })} error={errors[`${errorPrefix}sizeMm`]} />
        <NumberField label="Total carat" suffix="ct" hint="All stones in this row" value={stone.totalCarat} onChangeText={(totalCarat) => onChange({ totalCarat })} error={errors[`${errorPrefix}totalCarat`]} />
      </Columns>
      {isDiamond ? (
        <TextField label="Colour grade" placeholder="e.g. G" value={stone.colorGrade} onChangeText={(colorGrade) => onChange({ colorGrade })} maxLength={10} autoCapitalize="characters" />
      ) : null}
      <MoneyField label="Price per stone" value={stone.unitCost} onChangeText={(unitCost) => onChange({ unitCost })} error={errors[`${errorPrefix}unitCost`]} />
      <Columns>
        <SelectField label="Setting" options={optionsOf(STONE_SETTINGS)} value={stone.setting} allowClear onChange={(setting) => onChange({ setting })} />
        <SupplierField value={stone.supplierId} onChange={(supplierId) => onChange({ supplierId })} />
      </Columns>
    </View>
  );
}
