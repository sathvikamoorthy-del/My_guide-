# jest-react

Testing module for React apps (STORY-053b). `jest.config.js` (jsdom, ts-jest, setup file, coverage gate that leaves the scaffold glue out), `src/testing/setup.ts` (Testing Library matchers, `matchMedia`, `ResizeObserver`, `scrollTo`) and `renderApp(ui, { route?, providers? })` (renders inside the app's providers, first = outermost, and a router at `route`). Add `"test": "jest"` to the app's scripts.
