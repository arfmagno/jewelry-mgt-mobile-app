import { purgeExpired, SyncEngine, uploadPendingImages, type Store, type SyncStatus } from "@jewelry/core";
import * as Network from "expo-network";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { createApiClient, type ApiClient } from "@/lib/api";
import { auth } from "@/lib/auth";
import { config, isCloudEnabled } from "@/lib/config";

/**
 * App-wide services: the local store (always available), and — when the cloud
 * is configured and the user is signed in — the API client and sync engine.
 *
 * Sync runs on launch, when connectivity returns, when the app comes to the
 * foreground, a few seconds after local edits, and every few minutes.
 */

export type AuthState = "loading" | "signed_out" | "signed_in" | "local_only";

type AppContextValue = {
  store: Store;
  authState: AuthState;
  api: ApiClient | null;
  syncStatus: SyncStatus | null;
  online: boolean;
  syncNow: () => Promise<void>;
  onSignedIn: () => void;
  signOut: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

const EDIT_DEBOUNCE_MS = 4_000;
const PERIODIC_MS = 5 * 60_000;

export function AppProvider({ store, children }: { store: Store; children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>(isCloudEnabled() ? "loading" : "local_only");
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [online, setOnline] = useState(true);
  const onlineRef = useRef(true);

  const api = useMemo(
    () =>
      isCloudEnabled()
        ? createApiClient({ baseUrl: config.apiUrl, getToken: () => auth.getAccessToken() })
        : null,
    [],
  );
  const engine = useMemo(() => (api ? new SyncEngine(store, api) : null), [api, store]);

  useEffect(() => {
    if (!isCloudEnabled()) return;
    auth.isSignedIn().then((yes) => setAuthState(yes ? "signed_in" : "signed_out"));
  }, []);

  const syncNow = useCallback(async () => {
    if (!engine || !api || authState !== "signed_in" || !onlineRef.current) return;
    try {
      await uploadPendingImages(store, api);
    } catch {
      // Photos retry on the next run; records still sync.
    }
    try {
      await engine.sync();
    } catch (e) {
      if ((e as { code?: string }).code === "signed_out") setAuthState("signed_out");
    }
  }, [engine, api, store, authState]);

  // Status feed for the header indicator.
  useEffect(() => {
    if (!engine) return;
    const unsub = engine.subscribe(setSyncStatus);
    engine.refreshStatus();
    return unsub;
  }, [engine]);

  // Connectivity.
  useEffect(() => {
    const apply = (s: Network.NetworkState) => {
      const now = s.isConnected !== false && s.isInternetReachable !== false;
      const cameBack = now && !onlineRef.current;
      onlineRef.current = now;
      setOnline(now);
      if (cameBack) syncNow();
    };
    Network.getNetworkStateAsync().then(apply).catch(() => undefined);
    const sub = Network.addNetworkStateListener(apply);
    return () => sub.remove();
  }, [syncNow]);

  // Launch, foreground, periodic.
  useEffect(() => {
    if (authState !== "signed_in") return;
    const first = setTimeout(syncNow, 0);
    const appSub = AppState.addEventListener("change", (s) => s === "active" && syncNow());
    const timer = setInterval(syncNow, PERIODIC_MS);
    return () => {
      clearTimeout(first);
      appSub.remove();
      clearInterval(timer);
    };
  }, [authState, syncNow]);

  // Shortly after local edits.
  useEffect(() => {
    if (!engine) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsub = store.subscribe(() => {
      engine.refreshStatus();
      clearTimeout(timer);
      timer = setTimeout(syncNow, EDIT_DEBOUNCE_MS);
    });
    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, [engine, store, syncNow]);

  const value = useMemo<AppContextValue>(
    () => ({
      store,
      authState,
      api,
      syncStatus,
      online,
      syncNow,
      onSignedIn: () => setAuthState("signed_in"),
      signOut: async () => {
        await auth.signOut();
        setAuthState("signed_out");
      },
    }),
    [store, authState, api, syncStatus, online, syncNow],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const v = useContext(AppContext);
  if (!v) throw new Error("useApp must be used inside AppProvider");
  return v;
}

export const useStore = () => useApp().store;
