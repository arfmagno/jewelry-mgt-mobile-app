import { moneyToInput, parseMoney, PAYMENT_METHODS, type Payment } from "@jewelry/shared";
import { useState } from "react";
import { Modal, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, IconButton } from "@/components/Button";
import { ChoiceChips, DateField, MoneyField, optionsOf, TextField, todayIso } from "@/components/fields";
import { Screen } from "@/components/layout";
import { Text } from "@/components/Text";
import { orNull, reportError } from "@/lib/forms";
import { useStore } from "@/providers/app";
import { useTheme } from "@/theme";

/** Records a payment (down payment or balance) against an order. */
export function PaymentForm({
  orderId,
  payment,
  suggested,
  onClose,
}: {
  orderId: string;
  payment: Payment | null;
  suggested: number;
  onClose: () => void;
}) {
  const store = useStore();
  const { colors } = useTheme();
  const [amount, setAmount] = useState(moneyToInput(payment?.amount ?? (suggested > 0 ? suggested : null)));
  const [paidAt, setPaidAt] = useState(payment?.paidAt ?? todayIso());
  const [method, setMethod] = useState<Payment["method"]>(payment?.method ?? "cash");
  const [notes, setNotes] = useState(payment?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const value = parseMoney(amount);
    if (!value) {
      setError("Enter an amount above zero");
      return;
    }
    setSaving(true);
    try {
      await store.upsert("payments", payment?.id, { jobOrderId: orderId, amount: value, paidAt, method, notes: orNull(notes) });
      onClose();
    } catch (e) {
      reportError(e);
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16 }}>
          <Text variant="heading" style={{ flex: 1 }}>
            {payment ? "Edit payment" : "Record payment"}
          </Text>
          <IconButton icon="close" label="Close" onPress={onClose} />
        </View>
        <Screen footer={<Button testID="save-payment" label="Save payment" icon="checkmark" onPress={save} busy={saving} style={{ flex: 1 }} />}>
          <MoneyField testID="payment-amount" label="Amount" required value={amount} onChangeText={setAmount} error={error} hint="Down payments and partial payments are fine." />
          <DateField label="Date paid" required value={paidAt} onChange={(d) => d && setPaidAt(d)} />
          <ChoiceChips label="Method" options={optionsOf(PAYMENT_METHODS)} value={method} onChange={(m) => m && setMethod(m)} />
          <TextField label="Notes" hint="Reference number, who paid…" value={notes} onChangeText={setNotes} multiline maxLength={2000} />
        </Screen>
      </SafeAreaView>
    </Modal>
  );
}
