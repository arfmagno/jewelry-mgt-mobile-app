import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useState, type ReactNode } from "react";
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TOUCH_TARGET, useModalAnimation, useTheme } from "@/theme";
import { Button, IconButton } from "./Button";
import { Text } from "./Text";

// ── Shared field chrome: visible label, hint, and an error that is announced ──

type ChromeProps = { label: string; hint?: string; error?: string | null; required?: boolean; children: ReactNode };

export function FieldChrome({ label, hint, error, required, children }: ChromeProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Text variant="label">
        {label}
        {required ? <Text variant="label" color={colors.textMuted}>{"  (required)"}</Text> : null}
      </Text>
      {children}
      {hint && !error ? (
        <Text variant="caption" muted>
          {hint}
        </Text>
      ) : null}
      {error ? (
        <View style={styles.errorRow} accessible accessibilityLiveRegion="polite" accessibilityRole="alert">
          <Ionicons name="alert-circle" size={16} color={colors.danger} accessibilityElementsHidden />
          <Text variant="caption" color={colors.danger}>
            {error}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// ── Text ──

type TextFieldProps = Omit<TextInputProps, "onChange" | "value" | "onChangeText"> & {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  hint?: string;
  error?: string | null;
  required?: boolean;
  prefix?: string;
  suffix?: string;
};

export function TextField({ label, hint, error, required, prefix, suffix, style, multiline, ...input }: TextFieldProps) {
  const { colors, fonts, radius } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <FieldChrome label={label} hint={hint} error={error} required={required}>
      <View
        style={[
          styles.inputBox,
          {
            borderColor: error ? colors.danger : focused ? colors.focus : colors.border,
            borderWidth: focused || error ? 2 : 1,
            borderRadius: radius.md,
            backgroundColor: colors.surface,
          },
        ]}
      >
        {prefix ? <Text muted>{prefix}</Text> : null}
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={hint}
          aria-invalid={!!error}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.accent}
          multiline={multiline}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            styles.input,
            { color: colors.text, fontFamily: fonts.body },
            multiline && { minHeight: 96, textAlignVertical: "top", paddingTop: 12 },
            style,
          ]}
          {...input}
        />
        {suffix ? <Text muted>{suffix}</Text> : null}
      </View>
    </FieldChrome>
  );
}

type NumberFieldProps = Omit<TextFieldProps, "keyboardType"> & { decimal?: boolean };

export function NumberField({ decimal = true, ...props }: NumberFieldProps) {
  const keyboardType: KeyboardTypeOptions = decimal ? "decimal-pad" : "number-pad";
  return <TextField keyboardType={keyboardType} inputMode={decimal ? "decimal" : "numeric"} {...props} />;
}

/** Money is typed in pesos and stored as centavos by the caller (see `parseMoney`). */
export function MoneyField(props: Omit<TextFieldProps, "keyboardType" | "prefix">) {
  return <TextField keyboardType="decimal-pad" inputMode="decimal" prefix="₱" {...props} />;
}

// ── Choices ──

export type Option<V extends string> = { value: V; label: string };

export function optionsOf<V extends string>(o: { values: readonly V[]; labels: Record<V, string> }): Option<V>[] {
  return o.values.map((value) => ({ value, label: o.labels[value] }));
}

/** Small option sets as a wrapping row of radio "chips". */
export function ChoiceChips<V extends string>({
  label,
  options,
  value,
  onChange,
  allowClear,
  error,
  hint,
}: {
  label: string;
  options: Option<V>[];
  value: V | null;
  onChange: (v: V | null) => void;
  allowClear?: boolean;
  error?: string | null;
  hint?: string;
}) {
  const { colors, radius } = useTheme();
  return (
    <FieldChrome label={label} error={error} hint={hint}>
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.chips}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={o.label}
              onPress={() => onChange(selected && allowClear ? null : o.value)}
              style={[
                styles.chip,
                {
                  borderRadius: radius.pill,
                  borderColor: selected ? colors.accent : colors.border,
                  backgroundColor: selected ? colors.accentSoft : "transparent",
                },
              ]}
            >
              {selected ? <Ionicons name="checkmark" size={16} color={colors.accent} /> : null}
              <Text variant="label" color={selected ? colors.text : colors.textMuted}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </FieldChrome>
  );
}

/** Longer option lists in a full-screen picker with optional search. */
export function SelectField<V extends string>({
  label,
  options,
  value,
  onChange,
  placeholder = "Choose…",
  allowClear,
  error,
  hint,
  required,
  createLabel,
  onCreate,
  testID,
}: {
  label: string;
  options: Option<V>[];
  value: V | null;
  onChange: (v: V | null) => void;
  placeholder?: string;
  allowClear?: boolean;
  error?: string | null;
  hint?: string;
  required?: boolean;
  /** Offers creating a new record from the picker (e.g. "New client"). */
  createLabel?: string;
  onCreate?: () => void;
  testID?: string;
}) {
  const { colors, radius } = useTheme();
  const animation = useModalAnimation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const current = options.find((o) => o.value === value);
  const shown = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  return (
    <FieldChrome label={label} error={error} hint={hint} required={required}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? "not set"}`}
        accessibilityHint="Opens a list of options"
        onPress={() => setOpen(true)}
        style={[
          styles.inputBox,
          {
            borderColor: error ? colors.danger : colors.border,
            borderWidth: error ? 2 : 1,
            borderRadius: radius.md,
            backgroundColor: colors.surface,
          },
        ]}
      >
        <Text style={{ flex: 1 }} muted={!current}>
          {current?.label ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
      </Pressable>
      <Modal visible={open} animationType={animation} onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={[styles.modalHeader, { borderColor: colors.divider }]}>
            <Text variant="heading" style={{ flex: 1 }}>
              {label}
            </Text>
            <IconButton icon="close" label="Close" onPress={() => setOpen(false)} />
          </View>
          {options.length > 8 ? (
            <View style={{ paddingHorizontal: 16 }}>
              <TextField label="Search" value={query} onChangeText={setQuery} autoCorrect={false} />
            </View>
          ) : null}
          <FlatList
            data={allowClear ? [{ value: "" as V, label: "None" }, ...shown] : shown}
            keyExtractor={(o) => o.value || "__none"}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const selected = (item.value || null) === value;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => {
                    onChange((item.value || null) as V | null);
                    setOpen(false);
                    setQuery("");
                  }}
                  style={({ pressed }) => [
                    styles.option,
                    { borderColor: colors.divider, backgroundColor: pressed ? colors.accentSoft : "transparent" },
                  ]}
                >
                  <Text style={{ flex: 1 }}>{item.label}</Text>
                  {selected ? <Ionicons name="checkmark-circle" size={22} color={colors.accent} /> : null}
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <Text muted style={{ padding: 16 }}>
                No matches.
              </Text>
            }
            ListFooterComponent={
              onCreate ? (
                <View style={{ padding: 16 }}>
                  <Button
                    label={createLabel ?? "Add new"}
                    icon="add"
                    variant="secondary"
                    onPress={() => {
                      setOpen(false);
                      onCreate();
                    }}
                  />
                </View>
              ) : undefined
            }
          />
        </SafeAreaView>
      </Modal>
    </FieldChrome>
  );
}

// ── Switch ──

export function SwitchRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={styles.switchRow}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label">{label}</Text>
        {hint ? (
          <Text variant="caption" muted>
            {hint}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.accent, false: colors.border }}
        thumbColor={colors.surfaceRaised}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      />
    </Pressable>
  );
}

// ── Date (stored as YYYY-MM-DD) ──

const toDate = (s: string | null) => (s ? new Date(`${s}T00:00:00`) : new Date());
const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const todayIso = () => toIso(new Date());

export function formatDate(iso: string | null): string {
  if (!iso) return "";
  return toDate(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function DateField({
  label,
  value,
  onChange,
  allowClear,
  error,
  hint,
  required,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  allowClear?: boolean;
  error?: string | null;
  hint?: string;
  required?: boolean;
}) {
  const { colors, radius } = useTheme();
  const [iosOpen, setIosOpen] = useState(false);

  const open = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: toDate(value),
        mode: "date",
        onChange: (event, date) => {
          if (event.type === "set" && date) onChange(toIso(date));
        },
      });
    } else {
      setIosOpen((o) => !o);
    }
  };

  return (
    <FieldChrome label={label} error={error} hint={hint} required={required}>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${value ? formatDate(value) : "not set"}`}
          accessibilityHint="Opens a date picker"
          onPress={open}
          style={[
            styles.inputBox,
            {
              flex: 1,
              borderColor: error ? colors.danger : colors.border,
              borderRadius: radius.md,
              borderWidth: 1,
              backgroundColor: colors.surface,
            },
          ]}
        >
          <Ionicons name="calendar-outline" size={20} color={colors.accent} />
          <Text muted={!value} style={{ flex: 1 }}>
            {value ? formatDate(value) : "Not set"}
          </Text>
        </Pressable>
        {allowClear && value ? <IconButton icon="close-circle-outline" label={`Clear ${label}`} onPress={() => onChange(null)} /> : null}
      </View>
      {Platform.OS !== "android" && iosOpen ? (
        <DateTimePicker
          value={toDate(value)}
          mode="date"
          display="inline"
          onChange={(_, d) => d && onChange(toIso(d))}
        />
      ) : null}
    </FieldChrome>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  errorRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  inputBox: {
    minHeight: TOUCH_TARGET,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 8,
  },
  input: { flex: 1, fontSize: 16, minHeight: TOUCH_TARGET, paddingVertical: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: TOUCH_TARGET,
    paddingHorizontal: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  option: {
    minHeight: TOUCH_TARGET + 8,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  switchRow: { minHeight: TOUCH_TARGET + 8, flexDirection: "row", alignItems: "center", gap: 12 },
});
