import { useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { Button, IconButton } from "@/components/Button";
import { Columns, Thumb } from "@/components/layout";
import { Text } from "@/components/Text";
import { deleteLocalImage, PermissionDeniedError, pickImages, storeImage, type PickSource } from "@/lib/images";
import { useApp } from "@/providers/app";
import { useTheme } from "@/theme";
import { DesignGenerator } from "./DesignGenerator";
import { newKey, type ImageForm } from "./form";

type Props = {
  images: ImageForm[];
  description: string;
  onChange: (images: ImageForm[]) => void;
  /** Files created during this edit session, removed again if the edit is cancelled. */
  onFileCreated: (uri: string) => void;
};

export function PhotosEditor({ images, description, onChange, onFileCreated }: Props) {
  const { store, api, online } = useApp();
  const { colors } = useTheme();
  const [busy, setBusy] = useState<PickSource | null>(null);
  const [designing, setDesigning] = useState(false);

  const add = async (source: PickSource) => {
    setBusy(source);
    try {
      const uris = await pickImages(source);
      const added: ImageForm[] = [];
      for (const uri of uris) {
        const id = store.newId();
        const localUri = await storeImage(uri, id);
        onFileCreated(localUri);
        added.push({ key: newKey(), id, localUri, storageKey: null, source: "upload", aiPrompt: null, isPrimary: false });
      }
      if (added.length) onChange([...images, ...added]);
    } catch (e) {
      Alert.alert("Photos", e instanceof PermissionDeniedError ? `${e.message} You can allow it in system settings.` : "The photo could not be added.");
    } finally {
      setBusy(null);
    }
  };

  const keepDesign = async (draftUri: string, prompt: string) => {
    const id = store.newId();
    const localUri = await storeImage(draftUri, id);
    onFileCreated(localUri);
    onChange([...images, { key: newKey(), id, localUri, storageKey: null, source: "ai", aiPrompt: prompt, isPrimary: images.length === 0 }]);
  };

  const remove = (im: ImageForm) => onChange(images.filter((x) => x.key !== im.key));
  const makeCover = (im: ImageForm) => onChange(images.map((x) => ({ ...x, isPrimary: x.key === im.key })));
  const coverKey = (images.find((i) => i.isPrimary) ?? images[0])?.key;

  return (
    <View style={{ gap: 12 }}>
      {images.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
          {images.map((im, i) => {
            const isCover = im.key === coverKey;
            const label = `${im.source === "ai" ? "AI design" : "Photo"} ${i + 1}${isCover ? ", cover" : ""}`;
            return (
              <View key={im.key} style={{ width: 150, gap: 4 }}>
                <Thumb image={im} size={150} label={label} />
                <Text variant="caption" muted={!isCover} color={isCover ? colors.accent : undefined}>
                  {isCover ? "★ Cover" : im.source === "ai" ? "AI design" : "Photo"}
                </Text>
                <View style={{ flexDirection: "row" }}>
                  {!isCover ? <IconButton icon="star-outline" label={`Make ${label} the cover`} onPress={() => makeCover(im)} /> : null}
                  <IconButton icon="trash-outline" label={`Remove ${label}`} onPress={() => remove(im)} />
                </View>
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <Text muted>No photos yet.</Text>
      )}
      <Columns>
        <Button label="Take photo" icon="camera-outline" variant="secondary" busy={busy === "camera"} onPress={() => add("camera")} />
        <Button label="Choose photos" icon="images-outline" variant="secondary" busy={busy === "library"} onPress={() => add("library")} />
        {api ? (
          <Button
            label="Generate design"
            icon="sparkles-outline"
            variant="secondary"
            disabled={!online}
            hint={online ? "Creates a design image from a description" : "Needs an internet connection"}
            onPress={() => setDesigning(true)}
          />
        ) : null}
      </Columns>
      {designing ? (
        <DesignGenerator initialDescription={description} onKeep={keepDesign} onClose={() => setDesigning(false)} />
      ) : null}
    </View>
  );
}

export const discardFiles = (uris: string[]) => uris.forEach(deleteLocalImage);
