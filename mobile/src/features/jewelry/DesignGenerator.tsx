import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Modal, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, IconButton } from "@/components/Button";
import { SwitchRow, TextField } from "@/components/fields";
import { Screen } from "@/components/layout";
import { Text } from "@/components/Text";
import { ApiError } from "@/lib/api";
import { deleteLocalImage, writeDraft } from "@/lib/images";
import { useApp } from "@/providers/app";
import { useModalAnimation, useTheme } from "@/theme";

type Draft = { uri: string; prompt: string };

/**
 * Generates a design image from a description. Drafts live in the cache and
 * are deleted unless kept; only kept designs are attached to the piece.
 */
export function DesignGenerator({
  initialDescription,
  onKeep,
  onClose,
}: {
  initialDescription: string;
  onKeep: (uri: string, prompt: string) => Promise<void>;
  onClose: () => void;
}) {
  const { api, store } = useApp();
  const { colors, radius } = useTheme();
  const animation = useModalAnimation();
  const [description, setDescription] = useState(initialDescription);
  const [enhance, setEnhance] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const draftRef = useRef<Draft | null>(null);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  useEffect(() => () => deleteLocalImage(draftRef.current?.uri), []);

  const generate = async () => {
    if (!api) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.generateDesign({ description, enhancePrompt: enhance });
      const uri = await writeDraft(r.imageBase64, store.newId());
      deleteLocalImage(draft?.uri);
      setDraft({ uri, prompt: r.prompt });
      AccessibilityInfo.announceForAccessibility("Design ready");
    } catch (e) {
      setError(
        e instanceof ApiError && e.code === "ai_quota_exceeded"
          ? "Today's free design quota is used up. Try again tomorrow."
          : e instanceof ApiError
            ? e.message
            : "The design could not be generated.",
      );
    } finally {
      setBusy(false);
    }
  };

  const keep = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      await onKeep(draft.uri, draft.prompt);
      onClose();
    } catch {
      setError("The design could not be saved.");
      setBusy(false);
    }
  };

  return (
    <Modal visible animationType={animation} onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16 }}>
          <Text variant="heading" style={{ flex: 1 }}>
            Generate a design
          </Text>
          <IconButton icon="close" label="Close" onPress={onClose} />
        </View>
        <Screen
          footer={
            draft ? (
              <>
                <Button label="Try again" variant="secondary" icon="refresh" onPress={generate} disabled={busy} style={{ flex: 1 }} />
                <Button label="Keep design" icon="checkmark" onPress={keep} busy={busy} style={{ flex: 1 }} />
              </>
            ) : (
              <Button label="Generate" icon="sparkles-outline" onPress={generate} busy={busy} disabled={description.trim().length < 5} style={{ flex: 1 }} />
            )
          }
        >
          <TextField
            label="Describe the piece"
            hint="Metal, stones, shape and style, e.g. 18K rose gold halo ring with an oval centre stone."
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={1000}
          />
          <SwitchRow label="Improve my description" hint="Adds jewelry photography detail to the prompt" value={enhance} onChange={setEnhance} />
          {error ? (
            <Text color={colors.danger} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          {busy && !draft ? (
            <View style={{ alignItems: "center", gap: 8, padding: 24 }} accessibilityLiveRegion="polite">
              <ActivityIndicator color={colors.accent} size="large" />
              <Text muted>Creating your design…</Text>
            </View>
          ) : null}
          {draft ? (
            <View style={{ gap: 8 }}>
              <Image
                source={{ uri: draft.uri }}
                style={{ width: "100%", aspectRatio: 1, borderRadius: radius.lg }}
                contentFit="cover"
                accessibilityLabel={`Generated design for: ${description}`}
              />
              <Text variant="caption" muted>
                {"Designs you don't keep are discarded."}
              </Text>
            </View>
          ) : null}
        </Screen>
      </SafeAreaView>
    </Modal>
  );
}
