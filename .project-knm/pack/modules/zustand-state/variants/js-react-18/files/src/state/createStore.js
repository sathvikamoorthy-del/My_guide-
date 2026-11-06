// Application state with Zustand: a store with a `reset()` and optional, defensive persistence (a versioned JSON copy in
// localStorage; unreadable, corrupt or old-version data is ignored, a full or blocked storage never breaks the app).
import { create } from 'zustand';
function defaultStorage() {
    try {
        return typeof localStorage === 'undefined' ? null : localStorage;
    }
    catch {
        return null;
    }
}
export function createAppStore(initial, options = {}) {
    const storage = options.storage === undefined ? defaultStorage() : options.storage;
    const key = options.persistKey && `app-state:${options.persistKey}`;
    const version = options.version ?? 1;
    const read = () => {
        if (!key || !storage)
            return {};
        try {
            const raw = storage.getItem(key);
            if (!raw)
                return {};
            const saved = JSON.parse(raw);
            return saved && saved.version === version && saved.state && typeof saved.state === 'object' ? saved.state : {};
        }
        catch {
            return {};
        }
    };
    const write = (state) => {
        if (!key || !storage)
            return;
        try {
            storage.setItem(key, JSON.stringify({ version, state: pick(state, initial) }));
        }
        catch { /* storage full or blocked */ }
    };
    const useStore = create()((set) => ({
        ...initial,
        ...read(),
        // set first (the subscriber writes the initial state), then drop the saved copy: after a reset nothing is persisted
        reset: () => { set({ ...initial }); try {
            if (key && storage)
                storage.removeItem(key);
        }
        catch { /* ignore */ } }
    }));
    if (key)
        useStore.subscribe((state) => write(state));
    return useStore;
}
// only the data fields (never functions) are persisted, and only the ones the initial state declares
function pick(state, initial) {
    const out = {};
    for (const k of Object.keys(initial))
        if (typeof state[k] !== 'function')
            out[k] = state[k];
    return out;
}
