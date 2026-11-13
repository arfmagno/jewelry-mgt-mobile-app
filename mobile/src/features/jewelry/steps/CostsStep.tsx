import Ionicons from "@expo/vector-icons/Ionicons";
import { latestPrice } from "@jewelry/core";
import { COST_CATEGORIES, formatMoney, lineTotal, moneyToInput, parseMoney, suggestedPrice, UNITS, type CostCategory } from "@jewelry/shared";
import { Pressable, StyleSheet, View } from "react-native";
import { IconButton } from "@/components/Button";
import { MoneyField, NumberField, SelectField, TextField } from "@/components/fields";
import { MetalSwatch } from "@/components/illustrations";
import { Card, Columns } from "@/components/layout";
import { Text } from "@/components/Text";
import { SupplierField } from "@/features/suppliers/SupplierField";
import { useMaterials } from "@/hooks/useOptions";
import { parseNumber } from "@/lib/forms";
import { useStore } from "@/providers/app";
import { TOUCH_TARGET, useTheme } from "@/theme";
import { emptyCost, formTotals, formWeight, type CostForm, type PieceForm } from "../form";
import { StepTitle, type StepProps } from "./common";

type IconName = "hammer-outline" | "color-fill-outline" | "create-outline" | "pricetag-outline";

const KINDS: { category: CostCategory; icon?: IconName; placeholder: string }[] = [
  { category: "metal", placeholder: "" },
  { category: "labor", icon: "hammer-outline", placeholder: "e.g. Casting and stone setting" },
  { category: "plating", icon: "color-fill-outline", placeholder: "e.g. Rhodium plating" },
  { category: "engraving", icon: "create-outline", placeholder: "e.g. Initials inside the band" },
  { category: "other", icon: "pricetag-outline", placeholder: "e.g. Box, clasp or ready-made chain" },
];

const metalLook = (f: PieceForm) => (f.metal === "silver" ? "silver" : f.metal === "other" ? "other" : (f.metalColor ?? "yellow"));

function CategoryIcon({ category, form, size = 28 }: { category: CostCategory; form: PieceForm; size?: number }) {
  const { colors } = useTheme();
  const icon = KINDS.find((k) => k.category === category)?.icon;
  if (!icon) return <MetalSwatch look={metalLook(form)} size={size} ring={colors.border} />;
  return <Ionicons name={icon} size={size} color={colors.accent} accessibilityElementsHidden />;
}

const lineAmount = (c: CostForm) => {
  const unit = parseMoney(c.unitCost);
  const qty = parseNumber(c.quantity);
  return unit !== null && qty ? lineTotal(qty, unit) : 0;
};

export function CostsStep({ form, set, errors, settings, goTo }: StepProps) {
  const { colors, radius } = useTheme();
  const totals = formTotals(form);
  const byCategory = (cats: CostCategory[]) => form.costs.filter((c) => cats.includes(c.category)).reduce((s, c) => s + lineAmount(c), 0);
  const update = (key: string, patch: Partial<CostForm>) => set({ costs: form.costs.map((c) => (c.key === key ? { ...c, ...patch } : c)) });
  const add = (category: CostCategory) =>
    set({ costs: [...form.costs, category === "metal" ? { ...emptyCost("metal"), quantity: formWeight(form) } : emptyCost(category)] });

  const rows: [string, number][] = [
    ["Stones", totals.stones],
    ["Metal", byCategory(["metal"])],
    ["Labor, plating & engraving", byCategory(["labor", "plating", "engraving"])],
    ["Other", byCategory(["other"])],
  ];

  return (
    <>
      <StepTitle title="Costs" subtitle="What went into this piece. The total updates as you type." />

      <View
        accessible
        accessibilityLabel={`Total cost ${formatMoney(totals.total)}. Suggested price ${formatMoney(suggestedPrice(totals.total, settings.defaultMarkupPct))}.`}
        style={[styles.total, { backgroundColor: colors.accentSoft, borderColor: colors.accent, borderRadius: radius.lg }]}
      >
        <Text variant="caption" muted>
          Total cost
        </Text>
        <Text variant="display" color={colors.text} style={{ fontVariant: ["tabular-nums"] }}>
          {formatMoney(totals.total)}
        </Text>
        {rows
          .filter(([, v]) => v > 0)
          .map(([label, v]) => (
            <View key={label} style={styles.totalRow}>
              <Text muted style={{ flex: 1 }}>
                {label}
              </Text>
              <Text variant="money">{formatMoney(v)}</Text>
            </View>
          ))}
        <View style={[styles.totalRow, { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.accent, paddingTop: 8 }]}>
          <Text variant="label" style={{ flex: 1 }}>
            Suggested price (+{settings.defaultMarkupPct}%)
          </Text>
          <Text variant="money" color={colors.accent}>
            {formatMoney(suggestedPrice(totals.total, settings.defaultMarkupPct))}
          </Text>
        </View>
      </View>

      {totals.stones > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Stones, ${formatMoney(totals.stones)}. Edit on the stones step.`}
          onPress={() => goTo(3)}
          style={[styles.line, { borderColor: colors.divider, borderRadius: radius.md, backgroundColor: colors.surface }]}
        >
          <Ionicons name="diamond-outline" size={24} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text variant="label">Stones</Text>
            <Text variant="caption" muted>
              Priced on the stones step
            </Text>
          </View>
          <Text variant="money">{formatMoney(totals.stones)}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}

      {form.costs.map((c, i) => (
        <CostCard key={c.key} cost={c} index={i} form={form} errors={errors} trackStock={settings.materialTracking} onChange={(p) => update(c.key, p)} onRemove={() => set({ costs: form.costs.filter((x) => x.key !== c.key) })} />
      ))}

      <View style={{ gap: 8 }}>
        <Text variant="label">Add a cost</Text>
        <View style={styles.addRow}>
          {KINDS.map((k) => (
            <Pressable
              key={k.category}
              testID={`add-cost-${k.category}`}
              accessibilityRole="button"
              accessibilityLabel={`Add ${COST_CATEGORIES.labels[k.category]} cost`}
              onPress={() => add(k.category)}
              style={({ pressed }) => [
                styles.addTile,
                { borderColor: colors.divider, borderRadius: radius.md, backgroundColor: pressed ? colors.accentSoft : colors.surface },
              ]}
            >
              <CategoryIcon category={k.category} form={form} />
              <Text variant="caption" align="center">
                {k.category === "plating" ? "Plating" : COST_CATEGORIES.labels[k.category]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </>
  );
}

function CostCard({
  cost,
  index,
  form,
  errors,
  trackStock,
  onChange,
  onRemove,
}: {
  cost: CostForm;
  index: number;
  form: PieceForm;
  errors: StepProps["errors"];
  trackStock: boolean;
  onChange: (patch: Partial<CostForm>) => void;
  onRemove: () => void;
}) {
  const store = useStore();
  const materials = useMaterials(trackStock && cost.category === "metal");
  const kind = KINDS.find((k) => k.category === cost.category)!;
  const label = COST_CATEGORIES.labels[cost.category];
  const amount = lineAmount(cost);
  const p = `costs.${index}.`;

  const pickMaterial = async (materialId: string | null) => {
    onChange({ materialId });
    if (!materialId) return;
    // Prefill with the most recent purchase price (from this supplier when chosen).
    const price = (await latestPrice(store, materialId, cost.supplierId)) ?? (await latestPrice(store, materialId));
    if (price) onChange({ materialId, unitCost: moneyToInput(price.unitPrice), supplierId: cost.supplierId ?? price.supplierId });
  };

  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <CategoryIcon category={cost.category} form={form} />
        <Text variant="heading" style={{ flex: 1 }}>
          {label}
        </Text>
        {amount ? <Text variant="money">{formatMoney(amount)}</Text> : null}
        <IconButton icon="trash-outline" label={`Remove ${label} cost`} onPress={onRemove} />
      </View>
      {cost.category === "metal" ? (
        <>
          <Columns>
            <NumberField label="Weight" suffix="g" value={cost.quantity} onChangeText={(quantity) => onChange({ quantity })} error={errors[`${p}quantity`]} required />
            <MoneyField label="Price per gram" value={cost.unitCost} onChangeText={(unitCost) => onChange({ unitCost })} error={errors[`${p}unitCost`]} required />
          </Columns>
          <SupplierField value={cost.supplierId} onChange={(supplierId) => onChange({ supplierId })} />
          {materials ? (
            <SelectField
              label="Take from stock"
              hint="Deducts the weight from material stock"
              options={materials.map((m) => ({ value: m.id, label: `${m.name} (${UNITS.labels[m.unit]})` }))}
              value={cost.materialId}
              allowClear
              onChange={pickMaterial}
            />
          ) : null}
        </>
      ) : (
        <>
          <TextField label="What for? (optional)" placeholder={kind.placeholder} value={cost.description} onChangeText={(description) => onChange({ description })} maxLength={200} />
          <MoneyField testID={`cost-amount-${index}`} label="Amount" value={cost.unitCost} onChangeText={(unitCost) => onChange({ unitCost, quantity: "1" })} error={errors[`${p}unitCost`]} required />
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  total: { borderWidth: 1, padding: 16, gap: 6 },
  totalRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  line: { minHeight: TOUCH_TARGET + 16, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, borderWidth: 1 },
  addRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  addTile: { flexGrow: 1, flexBasis: 88, minHeight: TOUCH_TARGET + 32, alignItems: "center", justifyContent: "center", gap: 6, padding: 8, borderWidth: 1 },
});
