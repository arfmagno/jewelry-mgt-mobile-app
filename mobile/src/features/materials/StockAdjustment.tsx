import { STOCK_REASONS, type StockAdjustment as Adjustment } from "@jewelry/shared";
import { useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/Button";
import { ChoiceChips, DateField, NumberField, optionsOf, TextField, todayIso } from "@/components/fields";
import { Card, Columns } from "@/components/layout";
import { Text } from "@/components/Text";
import { orNull, parseNumber, reportError } from "@/lib/forms";
import { useStore } from "@/providers/app";

/** Manual stock change: opening balance, loss, scrap, return or correction. */
export function StockAdjustmentForm({ materialId, unit, onDone }: { materialId: string; unit: string; onDone: () => void }) {
  const store = useStore();
  const [reason, setReason] = useState<Adjustment["reason"]>("opening");
  const [quantity, setQuantity] = useState("");
  const [date, setDate] = useState(todayIso());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const reduces = reason === "loss" || reason === "scrap" || reason === "return";

  const save = async () => {
    const q = parseNumber(quantity);
    if (q === null || !Number.isFinite(q) || q === 0) {
      setError("Enter a quantity");
      return;
    }
    // Reductions are entered as positive numbers and stored as negative.
    const signed = reduces ? -Math.abs(q) : reason === "opening" ? Math.abs(q) : q;
    try {
      await store.insert("stockAdjustments", { materialId, quantity: signed, reason, date, notes: orNull(notes) });
      onDone();
    } catch (e) {
      reportError(e);
    }
  };

  return (
    <Card>
      <Text variant="heading">Adjust stock</Text>
      <ChoiceChips label="Reason" options={optionsOf(STOCK_REASONS)} value={reason} onChange={(r) => r && setReason(r)} />
      <Columns>
        <NumberField
          label={reduces ? "Quantity removed" : "Quantity"}
          hint={reason === "correction" ? "Use a minus sign to reduce stock" : undefined}
          suffix={unit}
          value={quantity}
          onChangeText={setQuantity}
          error={error}
        />
        <DateField label="Date" value={date} onChange={(d) => d && setDate(d)} />
      </Columns>
      <TextField label="Notes" value={notes} onChangeText={setNotes} maxLength={2000} />
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Button label="Cancel" variant="ghost" onPress={onDone} style={{ flex: 1 }} />
        <Button label="Save adjustment" onPress={save} style={{ flex: 2 }} />
      </View>
    </Card>
  );
}
