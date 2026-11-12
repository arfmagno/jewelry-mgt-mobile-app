/**
 * Hand-off channel between screens: a form opens another screen to create a
 * record (e.g. a new client from the order form) and receives its id on return.
 */
type Listener = (id: string) => void;
const listeners = new Map<string, Set<Listener>>();

export const selection = {
  deliver(channel: string, id: string) {
    for (const l of listeners.get(channel) ?? []) l(id);
  },
  listen(channel: string, l: Listener): () => void {
    const set = listeners.get(channel) ?? new Set<Listener>();
    set.add(l);
    listeners.set(channel, set);
    return () => set.delete(l);
  },
};
