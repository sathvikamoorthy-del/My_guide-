// knm-managed: v1 version: 1
// In-memory mock data store, mirrored to sessionStorage so the walkthrough shell
// and the framed mock app (same origin) see the same state.
// one key per app folder, so apps do not share state in one browser tab
const KEY = `${new URL('.', import.meta.url).pathname}state.v1`;
const DEFAULT_SEED = new URL('./mock-data/seeds/default.json', import.meta.url);

let state = null;

function readSession() {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSession() {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage blocked: state still works within this window */
  }
}

export async function initStore({ reset = false, seedUrl = DEFAULT_SEED } = {}) {
  state = reset ? null : readSession();
  if (!state) {
    state = await (await fetch(seedUrl)).json();
    writeSession();
  }
  return state;
}

export function getState() {
  return state;
}

export function setState(next) {
  state = structuredClone(next);
  writeSession();
}

export const snapshot = () => structuredClone(state);

export function getPath(path, obj = state) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

// change: a number (added to the current value) or { set: value }
export function applyChange(path, change) {
  const keys = path.split('.');
  const last = keys.pop();
  const parent = keys.reduce((o, k) => o[k], state);
  parent[last] = typeof change === 'number' ? parent[last] + change : change.set;
  writeSession();
}
