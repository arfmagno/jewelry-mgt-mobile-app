import { COMPONENT_TYPES, type JewelryComponent, type Settings } from "@jewelry/shared";
import type { ReactNode } from "react";
import { View } from "react-native";
import { JewelryGlyph } from "@/components/illustrations";
import { Text } from "@/components/Text";
import { useTheme } from "@/theme";
import type { FormErrors, PieceForm } from "../form";

/** Props every step receives from the piece editor. */
export type StepProps = {
  form: PieceForm;
  set: (patch: Partial<PieceForm>) => void;
  errors: FormErrors;
  settings: Settings;
  goTo: (step: number) => void;
};

export function StepTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Text variant="title">{title}</Text>
      {subtitle ? <Text muted>{subtitle}</Text> : null}
    </View>
  );
}

/** Heading for one part of a piece, with its illustration. */
export function PartHeader({ type, count, action }: { type: JewelryComponent["type"]; count?: string; action?: ReactNode }) {
  const { colors, radius } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: 6 }}>
        <JewelryGlyph type={type} size={36} color={colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="heading">{COMPONENT_TYPES.labels[type]}</Text>
        {count ? (
          <Text variant="caption" muted>
            {count}
          </Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}
