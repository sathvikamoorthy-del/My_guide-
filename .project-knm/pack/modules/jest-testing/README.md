# jest-testing

Jest setup (STORY-053a). `jest.config.js` runs tests under `src/` and `tests/` in Node and fails the run below 80% coverage of application code (glue excluded). `src/testing/testUtils` has `mockReq`, `mockRes` (records status/body/headers, emits `finish`) and `withEnv` (sets env vars and always restores them). Add `"test": "jest"` to the app's scripts.
