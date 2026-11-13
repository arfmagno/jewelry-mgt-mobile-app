import { latestPrice, type MaterialWithStock } from "@jewelry/core";
import { COST_CATEGORIES, formatMoney, isServiceCost, lineTotal, moneyToInput, parseMoney, UNITS } from "@jewelry/shared";
import { View } from "react-native";
import { Button, IconButton } from "@/components/Button";
import { MoneyField, NumberField, optionsOf, SelectField, TextField, type Option } from "@/components/fields";
import { Card, Columns } from "@/components/layout";
import { Text } from "@/components/Text";
import { parseNumber } from "@/lib/forms";
import { useStore } from "@/providers/app";
import { emptyCost, type CostForm, type FormErrors } from "./form";

type Props = {
  costs: CostForm[];
  suppliers: Option<string>[];
  materials: MaterialWithStock[] | null;
  errors: FormErrors;
  onChange: (costs: CostForm[]) => void;
};

/** Cost lines: metal and other materials (from suppliers) and flat-fee work. */
export function CostsEditor({ costs, suppliers, materials, errors, onChange }: Props) {
  const store = useStore();
  const update = (key: string, patch: Partial<CostForm>) => onChange(costs.map((c) => (c.key === key ? { ...c, ...patch } : c)));

  const pickMaterial = async (c: CostForm, materialId: string | null) => {
    update(c.key, { materialId });
    if (!materialId) return;
    // Prefill with the most recent purchase price (from this supplier when chosen).
    const price = (await latestPrice(store, materialId, c.supplierId)) ?? (await latestPrice(store, materialId));
    if (price) update(c.key, { materialId, unitCost: moneyToInput(price.unitPrice), supplierId: c.supplierId ?? price.supplierId });
  };

  return (
    <View style={{ gap: 12 }}>
      {costs.map((c, i) => {
        const service = isServiceCost(c.category);
        const material = materials?.find((m) => m.id === c.materialId);
        const qty = parseNumber(c.quantity);
        const unit = parseMoney(c.unitCost);
        const total = qty && unit !== null ? lineTotal(qty, unit) : null;
        return (
          <Card key={c.key}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text variant="label" style={{ flex: 1 }}>
                Cost {i + 1}
              </Text>
              <IconButton icon="trash-outline" label={`Remove cost ${i + 1}`} onPress={() => onChange(costs.filter((x) => x.key !== c.key))} />
            </View>
            <SelectField
              label="Category"
              options={optionsOf(COST_CATEGORIES)}
              value={c.category}
              onChange={(category) =>
                category && update(c.key, isServiceCost(category) ? { category, materialId: null, supplierId: null } : { category })
              }
            />
            <TextField label="Description" placeholder={service ? "e.g. Rhodium plating" : "e.g. 18K casting grain"} value={c.description} onChangeText={(description) => update(c.key, { description })} maxLength={200} />
            {service ? null : (
              <Columns>
                <SelectField label="Supplier" options={suppliers} value={c.supplierId} allowClear onChange={(supplierId) => update(c.key, { supplierId })} />
                {materials ? (
                  <SelectField
                    label="From stock"
                    hint="Deducts from material stock"
                    options={materials.map((m) => ({ value: m.id, label: `${m.name} (${UNITS.labels[m.unit]})` }))}
                    value={c.materialId}
                    allowClear
                    onChange={(id) => pickMaterial(c, id)}
                  />
                ) : null}
              </Columns>
            )}
            <Columns>
              <NumberField
                label="Quantity"
                suffix={material ? material.unit : undefined}
                value={c.quantity}
                onChangeText={(quantity) => update(c.key, { quantity })}
                error={errors[`costs.${i}.quantity`]}
                required
              />
              <MoneyField label="Unit cost" value={c.unitCost} onChangeText={(unitCost) => update(c.key, { unitCost })} error={errors[`costs.${i}.unitCost`]} required />
            </Columns>
            {total !== null ? (
              <Text variant="money" align="right" accessibilityLabel={`Line total ${formatMoney(total)}`}>
                {formatMoney(total)}
              </Text>
            ) : null}
          </Card>
        );
      })}
      <Columns>
        <Button label="Add material cost" icon="add" variant="secondary" onPress={() => onChange([...costs, emptyCost("metal")])} />
        <Button label="Add labour or service" icon="add" variant="secondary" onPress={() => onChange([...costs, emptyCost("labor")])} />
      </Columns>
    </View>
  );
}
