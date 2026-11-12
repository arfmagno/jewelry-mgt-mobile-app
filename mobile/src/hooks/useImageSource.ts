import { File } from "expo-file-system";
import { useEffect, useState } from "react";
import type { ApiClient } from "@/lib/api";
import { useApp } from "@/providers/app";

type ImageRef = { localUri: string | null; storageKey: string | null } | null | undefined;

/** Presigned read URLs, cached until shortly before they expire. */
const cache = new Map<string, { url: string; until: number }>();

async function signedUrl(api: ApiClient, key: string): Promise<string | null> {
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return hit.url;
  const r = await api.imageUrls([key]);
  const url = r.urls[key];
  if (!url) return null;
  cache.set(key, { url, until: Date.now() + (r.expiresInSeconds - 60) * 1000 });
  return url;
}

function localExists(uri: string | null): uri is string {
  if (!uri) return false;
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}

/** Resolves a photo to a displayable URI: the local file when present, else a signed cloud URL. */
export function useImageSource(image: ImageRef): string | null {
  const { api, authState, online } = useApp();
  const local = image && localExists(image.localUri) ? image.localUri : null;
  const key = image?.storageKey ?? null;
  const [remote, setRemote] = useState<{ key: string; url: string } | null>(null);

  useEffect(() => {
    if (local || !key || !api || authState !== "signed_in" || !online) return;
    let cancelled = false;
    signedUrl(api, key)
      .then((url) => {
        if (url && !cancelled) setRemote({ key, url });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [local, key, api, authState, online]);

  return local ?? (remote && remote.key === key ? remote.url : null);
}
