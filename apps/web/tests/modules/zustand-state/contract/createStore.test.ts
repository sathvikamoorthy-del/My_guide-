/** @jest-environment jsdom */
import { createAppStore } from '../../../../src/state/createStore';

const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m }; };
type S = { count: number; name: string; inc(): void };
const initial = (): S => ({ count: 0, name: 'a', inc() { /* replaced below */ } });

describe('store contract', () => {
  it('holds state, updates it and resets to the initial values', () => {
    const useStore = createAppStore({ count: 0, name: 'a' });
    useStore.setState({ count: 5, name: 'b' });
    expect(useStore.getState()).toMatchObject({ count: 5, name: 'b' });
    useStore.getState().reset();
    expect(useStore.getState()).toMatchObject({ count: 0, name: 'a' });
  });

  it('persists data fields (never functions) under a versioned key and restores them', () => {
    const storage = memory();
    const first = createAppStore({ count: 0, name: 'a' }, { persistKey: 'demo', version: 2, storage });
    first.setState({ count: 3 });
    expect(JSON.parse(storage.m.get('app-state:demo')!)).toEqual({ version: 2, state: { count: 3, name: 'a' } });
    const second = createAppStore({ count: 0, name: 'a' }, { persistKey: 'demo', version: 2, storage });
    expect(second.getState().count).toBe(3);
    second.getState().reset();
    expect(storage.m.has('app-state:demo')).toBe(false);
  });

  it('ignores corrupt data and data written by another version', () => {
    const storage = memory();
    storage.setItem('app-state:demo', '{not json');
    expect(createAppStore({ count: 1 }, { persistKey: 'demo', storage }).getState().count).toBe(1);
    storage.setItem('app-state:demo', JSON.stringify({ version: 1, state: { count: 9 } }));
    expect(createAppStore({ count: 1 }, { persistKey: 'demo', version: 2, storage }).getState().count).toBe(1);
    storage.setItem('app-state:demo', JSON.stringify({ version: 1, state: 'oops' }));
    expect(createAppStore({ count: 1 }, { persistKey: 'demo', storage }).getState().count).toBe(1);
  });

  it('a full or blocked storage never breaks the app', () => {
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('full'); }, removeItem: () => { throw new Error('blocked'); } };
    const useStore = createAppStore({ count: 0 }, { persistKey: 'demo', storage: broken });
    expect(() => useStore.setState({ count: 1 })).not.toThrow();
    expect(() => useStore.getState().reset()).not.toThrow();
    expect(useStore.getState().count).toBe(0);
  });

  it('without a persist key nothing is written, and the default storage is localStorage', () => {
    createAppStore({ count: 0 }).setState({ count: 1 });
    expect(localStorage.length).toBe(0);
    const s = createAppStore({ count: 0 }, { persistKey: 'ls' });
    s.setState({ count: 4 });
    expect(JSON.parse(localStorage.getItem('app-state:ls')!).state.count).toBe(4);
    localStorage.clear();
    void initial;
  });
});
