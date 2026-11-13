import Ionicons from "@expo/vector-icons/Ionicons";
import { OrderAssistant, type AssistantTurn, type Choice, type DraftSummary } from "@jewelry/core";
import { formatMoney } from "@jewelry/shared";
import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, type ScrollViewInstance } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { todayIso } from "@/components/fields";
import { Text } from "@/components/Text";
import { reportError } from "@/lib/forms";
import { useApp } from "@/providers/app";
import { MAX_CONTENT_WIDTH, TOUCH_TARGET, useLayout, useTheme } from "@/theme";

type Message =
  | { id: number; from: "you"; text: string }
  | { id: number; from: "assistant"; turn: AssistantTurn; summary: DraftSummary | null };

/**
 * Create an order by describing it. The assistant reads each message (with the
 * AI model when online, on the phone otherwise), matches it to clients and
 * pieces, and asks for what is missing. Nothing is saved until "Create order".
 */
export default function OrderAssistantScreen() {
  const router = useRouter();
  const { store, api, online } = useApp();
  const { colors, fonts, radius } = useTheme();
  const { gutter } = useLayout();
  const { bottom } = useSafeAreaInsets();
  const scroller = useRef<ScrollViewInstance>(null);
  const today = useMemo(() => todayIso(), []);
  const useAi = !!api && online;
  const bot = useMemo(
    () =>
      new OrderAssistant(store, {
        today,
        interpret: api ? async (message) => (await api.interpretOrder({ message, today })).intent : undefined,
      }),
    [store, api, today],
  );
  const [messages, setMessages] = useState<Message[]>(() => [{ id: 0, from: "assistant", turn: bot.start(), summary: null }]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const last = messages.at(-1);
  const current = last?.from === "assistant" ? last : null;

  const respond = async (you: string | null, run: () => Promise<AssistantTurn>) => {
    setBusy(true);
    setMessages((m) => (you ? [...m, { id: m.length, from: "you", text: you }] : m));
    try {
      const turn = await run();
      setMessages((m) => [...m, { id: m.length, from: "assistant", turn, summary: turn.ready ? bot.summary() : null }]);
      AccessibilityInfo.announceForAccessibility(turn.text);
    } catch (e) {
      reportError(e);
    } finally {
      setBusy(false);
    }
  };

  const send = () => {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    void respond(text, () => bot.send(text));
  };

  const choose = (c: Choice) => {
    if (busy) return;
    void respond(c.label, () => bot.choose(c.value));
  };

  const create = async () => {
    setCreating(true);
    try {
      const id = await bot.create();
      router.replace(`/orders/${id}`);
    } catch (e) {
      reportError(e);
      setCreating(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        ref={scroller}
        testID="assistant-thread"
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => requestAnimationFrame(() => scroller.current?.scrollToEnd({ animated: true }))}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingVertical: 20, gap: 18 }}
      >
        <View style={[styles.column, { gap: 18 }]}>
          <View style={styles.mode} accessible>
            <Ionicons name={useAi ? "sparkles-outline" : "phone-portrait-outline"} size={14} color={colors.accent} />
            <Text variant="eyebrow" color={colors.accent}>
              {useAi ? "Read by AI · checked against your records" : "Read on this phone · works offline"}
            </Text>
          </View>
          {messages.map((m) =>
            m.from === "you" ? (
              <View key={m.id} style={[styles.you, { backgroundColor: colors.ink, borderRadius: radius.md }]} accessible accessibilityLabel={`You: ${m.text}`}>
                <Text color={colors.onInk}>{m.text}</Text>
              </View>
            ) : (
              <View key={m.id} style={[styles.assistant, { borderColor: colors.gold }]} accessibilityLiveRegion={m === current ? "polite" : "none"}>
                <Text style={{ fontFamily: fonts.display, fontSize: 19, lineHeight: 26, fontVariant: ["lining-nums"] }}>{m.turn.text}</Text>
                {m.summary ? <Summary summary={m.summary} /> : null}
                {m === current && m.turn.choices.length ? (
                  <View style={styles.choices}>
                    {m.turn.choices.map((c) => (
                      <Pressable
                        key={c.value}
                        testID={`choice-${c.value}`}
                        accessibilityRole="button"
                        accessibilityLabel={c.hint ? `${c.label}, ${c.hint}` : c.label}
                        disabled={busy}
                        onPress={() => choose(c)}
                        style={({ pressed }) => [
                          styles.choice,
                          { borderColor: colors.text, borderRadius: radius.sm, backgroundColor: pressed ? colors.accentSoft : "transparent" },
                        ]}
                      >
                        <Text variant="label">{c.label}</Text>
                        {c.hint ? (
                          <Text variant="caption" muted numberOfLines={2}>
                            {c.hint}
                          </Text>
                        ) : null}
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                {m === current && m.turn.ready ? (
                  <Button testID="assistant-create" label="Create order" icon="checkmark" onPress={create} busy={creating} />
                ) : null}
              </View>
            ),
          )}
          {busy ? (
            <View style={styles.mode} accessibilityLabel="Reading">
              <ActivityIndicator size="small" color={colors.accent} />
              <Text variant="caption" muted>
                Reading…
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.bar, { borderColor: colors.divider, backgroundColor: colors.surface, paddingHorizontal: gutter, paddingBottom: 10 + bottom }]}>
        <View style={[styles.column, { flexDirection: "row", alignItems: "flex-end", gap: 8 }]}>
          <TextInput
            testID="assistant-input"
            accessibilityLabel="Message"
            accessibilityHint="Describe the order, or answer the question. You can use the keyboard's microphone."
            placeholder={current?.turn.expecting === "anything" ? "Describe the order…" : "Your answer…"}
            placeholderTextColor={colors.textMuted}
            selectionColor={colors.accent}
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={1000}
            style={[styles.input, { color: colors.text, fontFamily: fonts.body, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.background }]}
          />
          <Pressable
            testID="assistant-send"
            accessibilityRole="button"
            accessibilityLabel="Send"
            accessibilityState={{ disabled: !draft.trim() || busy }}
            disabled={!draft.trim() || busy}
            onPress={send}
            style={({ pressed }) => [styles.send, { backgroundColor: colors.ink, opacity: !draft.trim() || busy ? 0.4 : pressed ? 0.8 : 1 }]}
          >
            <Ionicons name="arrow-up" size={20} color={colors.onInk} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

/** The order as it stands, laid out like a docket. */
function Summary({ summary: s }: { summary: DraftSummary }) {
  const { colors } = useTheme();
  const line = (label: string, value: string, strong?: boolean) => (
    <View style={styles.line} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text variant="eyebrow" muted style={{ flex: 1 }}>
        {label}
      </Text>
      <Text variant={strong ? "money" : "body"}>{value}</Text>
    </View>
  );
  return (
    <View testID="assistant-summary" style={[styles.summary, { borderColor: colors.divider }]}>
      <View style={{ gap: 2 }}>
        <Text variant="eyebrow" color={colors.accent}>
          {s.newClient ? "New client" : "Client"}
          {s.phone ? ` · ${s.phone}` : ""}
        </Text>
        <Text variant="heading">{s.client}</Text>
      </View>
      {s.items.map((i, n) => (
        <View key={n} style={[styles.item, { borderColor: colors.divider }]} accessible accessibilityLabel={`${i.label}, ${i.detail}, ${formatMoney(i.price)}${i.suggested ? ", suggested price" : ""}`}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="eyebrow" color={colors.accent}>
              {i.label}
            </Text>
            <Text numberOfLines={2}>{i.detail}</Text>
            {i.suggested ? (
              <Text variant="caption" muted>
                Suggested from cost and markup
              </Text>
            ) : null}
          </View>
          <Text variant="money">{formatMoney(i.price)}</Text>
        </View>
      ))}
      {line("Total", formatMoney(s.total), true)}
      {line(`Down payment${s.downPayment ? ` · ${s.method}` : ""}`, formatMoney(s.downPayment))}
      {line("Balance", formatMoney(s.balance), true)}
      {s.notes ? line("Notes", s.notes) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { width: "100%", maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" },
  mode: { flexDirection: "row", alignItems: "center", gap: 8 },
  you: { alignSelf: "flex-end", maxWidth: "85%", paddingHorizontal: 14, paddingVertical: 10 },
  assistant: { gap: 14, borderLeftWidth: 1, paddingLeft: 14, maxWidth: "100%" },
  choices: { gap: 8 },
  choice: { minHeight: TOUCH_TARGET, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, justifyContent: "center", gap: 2 },
  summary: { gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  item: { flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 10 },
  line: { flexDirection: "row", alignItems: "baseline", gap: 12 },
  bar: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  input: { flex: 1, minHeight: TOUCH_TARGET, maxHeight: 140, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16 },
  send: { width: TOUCH_TARGET, height: TOUCH_TARGET, borderRadius: TOUCH_TARGET / 2, alignItems: "center", justifyContent: "center" },
});
