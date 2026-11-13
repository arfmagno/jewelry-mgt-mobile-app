import { clearSampleData, hasSampleData, saveSettings, seedSampleData } from "@jewelry/core";
import { LENGTH_UNITS, RING_SIZE_SYSTEMS } from "@jewelry/shared";
import { useState } from "react";
import { Alert, View } from "react-native";
import { Button } from "@/components/Button";
import { ChoiceChips, NumberField, optionsOf, SwitchRow } from "@/components/fields";
import { Card, Screen, Section } from "@/components/layout";
import { Text } from "@/components/Text";
import { TilePicker } from "@/components/tiles";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useSettings } from "@/hooks/useSettings";
import { reportError } from "@/lib/forms";
import { useApp } from "@/providers/app";
import { dark, light, useTheme, type AppearancePreference } from "@/theme";

export default function SettingsScreen() {
  const { store, authState } = useApp();
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
      <AppearanceSection />
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
      {authState === "local_only" ? <SampleData /> : null}
    </Screen>
  );
}

/** Loads a ready-made set of clients, pieces and orders for trying the app. Offline-only, so it never syncs. */
function SampleData() {
  const { store } = useApp();
  const { data: loaded } = useLiveQuery((s) => hasSampleData(s), []);
  const [busy, setBusy] = useState(false);
  const run = (task: () => Promise<unknown>) => {
    setBusy(true);
    task()
      .catch(reportError)
      .finally(() => setBusy(false));
  };

  return (
    <Section title="Sample data">
      <Text variant="caption" muted>
        {loaded
          ? "Sample clients, pieces and orders are loaded. Removing them leaves your own records as they are."
          : "Fill the app with sample clients, pieces and eighteen months of orders to look around. You can remove them in one go."}
      </Text>
      {loaded ? (
        <Button
          testID="remove-sample-data"
          label="Remove sample data"
          icon="trash-outline"
          variant="secondary"
          busy={busy}
          onPress={() =>
            Alert.alert("Remove sample data?", "Sample records and anything added to them, such as payments on sample orders, are deleted.", [
              { text: "Cancel", style: "cancel" },
              { text: "Remove", style: "destructive", onPress: () => run(() => clearSampleData(store)) },
            ])
          }
        />
      ) : (
        <Button testID="load-sample-data" label="Load sample data" icon="sparkles-outline" busy={busy} onPress={() => run(() => seedSampleData(store))} />
      )}
    </Section>
  );
}

/** A small preview of a palette: page, a line of text and a black or gold button. */
function Swatch({ palette, half }: { palette: typeof light; half?: typeof light }) {
  const panel = (p: typeof light, flex = 1) => (
    <View style={{ flex, backgroundColor: p.background, padding: 8, gap: 5, justifyContent: "center" }}>
      <View style={{ height: 3, width: "70%", backgroundColor: p.text }} />
      <View style={{ height: 3, width: "45%", backgroundColor: p.textMuted }} />
      <View style={{ height: 8, width: "55%", marginTop: 4, backgroundColor: p.ink }} />
    </View>
  );
  return (
    <View style={{ width: 72, height: 54, flexDirection: "row", borderWidth: 1, borderColor: palette.gold, overflow: "hidden" }}>
      {panel(palette)}
      {half ? panel(half) : null}
    </View>
  );
}

function AppearanceSection() {
  const { appearance, setAppearance } = useTheme();
  return (
    <Section title="Appearance">
      <TilePicker<AppearancePreference>
        label="Theme"
        testIDPrefix="appearance"
        value={appearance}
        onChange={(v) => v && setAppearance(v)}
        tiles={[
          { value: "system", label: "System", caption: "Follow the phone", art: () => <Swatch palette={light} half={dark} /> },
          { value: "light", label: "Ivory", caption: "Light", art: () => <Swatch palette={light} /> },
          { value: "dark", label: "Noir", caption: "Dark", art: () => <Swatch palette={dark} /> },
        ]}
      />
    </Section>
  );
}
