import { formatMoney, pieceType } from "@jewelry/shared";
import { useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/Button";
import { DateField, TextField } from "@/components/fields";
import { JewelryGlyph } from "@/components/illustrations";
import { Text } from "@/components/Text";
import { useTheme } from "@/theme";
import { formTotals, suggestDescription } from "../form";
import { PhotosEditor } from "../PhotosEditor";
import { StepTitle, type StepProps } from "./common";

export function FinishStep({ form, set, errors, onFileCreated }: StepProps & { onFileCreated: (uri: string) => void }) {
  const { colors, radius } = useTheme();
  const suggestion = suggestDescription(form);
  const kind = pieceType(form.components.map((c) => c.type));
  const [noteOpen, setNoteOpen] = useState(form.notes.trim() !== "");

  return (
    <>
      <StepTitle title="Finishing touches" subtitle="Name the piece and add photos or AI designs." />

      <View style={{ flexDirection: "row", gap: 12, alignItems: "center", padding: 12, borderRadius: radius.lg, backgroundColor: colors.accentSoft }}>
        {kind ? <JewelryGlyph type={kind} size={44} color={colors.accent} /> : null}
        <View style={{ flex: 1 }}>
          <Text variant="label">{form.description.trim() || suggestion || "New piece"}</Text>
          <Text variant="caption" muted>
            Total cost {formatMoney(formTotals(form).total)}
          </Text>
        </View>
      </View>

      <TextField
        testID="piece-description"
        label="Description"
        required
        value={form.description}
        onChangeText={(description) => set({ description })}
        multiline
        maxLength={1000}
        error={errors.description}
      />
      {suggestion && form.description.trim() !== suggestion ? (
        <Button label={`Use “${suggestion}”`} icon="sparkles-outline" variant="ghost" onPress={() => set({ description: suggestion })} style={{ alignSelf: "flex-start" }} />
      ) : null}

      <PhotosEditor images={form.images} description={form.description} onChange={(images) => set({ images })} onFileCreated={onFileCreated} />

      <DateField label="Date made" value={form.manufactureDate} onChange={(manufactureDate) => set({ manufactureDate })} allowClear />

      {noteOpen ? (
        <TextField label="Notes" value={form.notes} onChangeText={(notes) => set({ notes })} multiline maxLength={2000} />
      ) : (
        <Button label="Add a note" icon="create-outline" variant="ghost" onPress={() => setNoteOpen(true)} style={{ alignSelf: "flex-start" }} />
      )}
    </>
  );
}
