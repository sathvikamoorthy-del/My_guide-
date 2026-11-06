# zustand-state

State module (STORY-053b). `createAppStore(initial, { persistKey?, version?, storage? })` is a Zustand store with `reset()` and optional persistence: a versioned JSON copy of the data fields (never functions); corrupt, old-version or unreadable data is ignored and a full/blocked storage never breaks the app. `useAsync(fn, deps)` returns `{ status, data | error, reload }`; an older slow call never overwrites a newer one and nothing is set after unmount.
