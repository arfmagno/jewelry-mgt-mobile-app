import type { Store } from "@jewelry/core";
import { useEffect, useRef, useState, type DependencyList } from "react";
import { useStore } from "@/providers/app";

export type LiveQuery<T> = {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
  reload: () => void;
};

type State<T> = { data: T | undefined; error: Error | null; loaded: boolean };

/**
 * Runs a read against the local store and re-runs it whenever the store
 * reports a change (local edit or applied sync), so screens stay current.
 * Out-of-order results are dropped; previous data stays visible while
 * a new query loads.
 */
export function useLiveQuery<T>(fn: (store: Store) => Promise<T>, deps: DependencyList): LiveQuery<T> {
  const store = useStore();
  const [state, setState] = useState<State<T>>({ data: undefined, error: null, loaded: false });
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    let active = true;
    let seq = 0;
    const run = () => {
      const id = ++seq;
      fnRef.current(store).then(
        (data) => active && id === seq && setState({ data, error: null, loaded: true }),
        (e: unknown) =>
          active &&
          id === seq &&
          setState((s) => ({ ...s, error: e instanceof Error ? e : new Error(String(e)), loaded: true })),
      );
    };
    run();
    const unsub = store.subscribe(run);
    return () => {
      active = false;
      unsub();
    };
    // `deps` are the caller's query inputs, like useMemo's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, tick, ...deps]);

  return { data: state.data, loading: !state.loaded, error: state.error, reload: () => setTick((t) => t + 1) };
}
