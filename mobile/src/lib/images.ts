import { Directory, File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

/**
 * Photos are compressed on the device (WebP, longest side ≤ 1600px) and kept in
 * the app's document directory until uploaded. AI drafts stay in the cache
 * directory and are removed unless the user keeps them.
 */

const MAX_SIDE = 1600;
const QUALITY = 0.8;

function imagesDir(): Directory {
  const dir = new Directory(Paths.document, "images");
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** Compresses an image and stores it permanently; returns the local file URI. */
export async function storeImage(sourceUri: string, id: string): Promise<string> {
  const ref = await ImageManipulator.manipulate(sourceUri, { maxWidth: MAX_SIDE, maxHeight: MAX_SIDE }).renderAsync();
  const saved = await ref.saveAsync({ format: SaveFormat.WEBP, compress: QUALITY });
  const dest = new File(imagesDir(), `${id}.webp`);
  if (dest.exists) dest.delete();
  await new File(saved.uri).move(dest);
  return dest.uri;
}

export function deleteLocalImage(uri: string | null | undefined) {
  if (!uri) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // Already gone; nothing to do.
  }
}

export type PickSource = "camera" | "library";

export class PermissionDeniedError extends Error {}

/** Lets the user take or choose photos; returns the picked URIs (empty if cancelled). */
export async function pickImages(source: PickSource): Promise<string[]> {
  if (source === "camera") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new PermissionDeniedError("Camera access is turned off for this app.");
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 });
    return r.canceled ? [] : r.assets.map((a) => a.uri);
  }
  const r = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 1,
    allowsMultipleSelection: true,
    selectionLimit: 10,
  });
  return r.canceled ? [] : r.assets.map((a) => a.uri);
}

/** Writes a generated design (base64 JPEG) to the cache so it can be previewed. */
export async function writeDraft(base64: string, id: string): Promise<string> {
  const file = new File(Paths.cache, `design-${id}.jpg`);
  if (file.exists) file.delete();
  file.create();
  await file.write(base64, { encoding: "base64" });
  return file.uri;
}
