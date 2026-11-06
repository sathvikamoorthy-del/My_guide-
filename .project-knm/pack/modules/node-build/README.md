# node-build

Build script (STORY-053a). TypeScript: `node scripts/build.js` compiles `src/` to `dist/` with the app's `tsconfig.json` (stale output removed, non-zero exit on type errors). JavaScript: copies `src/` to `dist/` without test files (no compile step). Add `"build": "node scripts/build.js"` to the app's scripts.
