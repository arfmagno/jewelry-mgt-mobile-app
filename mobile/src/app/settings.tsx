import { saveSettings } from "@jewelry/core";
import { LENGTH_UNITS, RING_SIZE_SYSTEMS } from "@jewelry/shared";
import { useState } from "react";
import { ChoiceChips, NumberField, optionsOf, SwitchRow } from "@/components/fields";
import { Card, Screen, Section } from "@/components/layout";
import { Text } from "@/components/Text";
import { useSettings } from "@/hooks/useSettings";
import { reportError } from "@/lib/forms";
import { useStore } from "@/providers/app";

export default function SettingsScreen() {
  const store = useStore();
  const settings = useSettings();
  const [markup, setMarkup] = useState<string | null>(null);
  const [markupError, setMarkupError] = useState<string | null>(null);

  const save = (patch: Parameters<typeof saveSettings>[1]) => saveSettings(store, patch).catch(reportError);

  const commitMarkup = () => {
    if (markup === null) return;
    const n = Number(markup);
    if (!Number.isFinite(n) || n < 0 || n > 1000) {
      setMarkupError("Enter a percentage from 0 to 1000");
      return;
    }
    setMarkupError(null);
    save({ defaultMarkupPct: n });
    setMarkup(null);
  };

  return (
    <Screen testID="settings">
      <Section title="Units">
        <Text variant="caption" muted>
          Measurements are stored in millimetres and shown in the units you choose.
        </Text>
        <ChoiceChips label="Chain and bracelet length" options={optionsOf(LENGTH_UNITS)} value={settings.lengthUnit} onChange={(lengthUnit) => lengthUnit && save({ lengthUnit })} />
        <ChoiceChips label="Ring size" options={optionsOf(RING_SIZE_SYSTEMS)} value={settings.ringSizeSystem} onChange={(ringSizeSystem) => ringSizeSystem && save({ ringSizeSystem })} />
      </Section>
      <Section title="Pricing">
        <NumberField
          label="Default markup"
          suffix="%"
          hint="Used to suggest a selling price from a piece's total cost."
          value={markup ?? String(settings.defaultMarkupPct)}
          onChangeText={setMarkup}
          onBlur={commitMarkup}
          onSubmitEditing={commitMarkup}
          error={markupError}
        />
      </Section>
      <Section title="Materials">
        <Card>
          <SwitchRow
            label="Track material stock"
            hint="Follow how much metal, stone and findings you have: purchases add stock, costs on pieces use it."
            value={settings.materialTracking}
            onChange={(materialTracking) => save({ materialTracking })}
          />
        </Card>
      </Section>
    </Screen>
  );
}
