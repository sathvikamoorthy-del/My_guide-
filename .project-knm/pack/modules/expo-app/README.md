# expo-app

Mobile framework module (KNM-073). Expo SDK 53 (React Native 0.79, React 19, Expo Router 5), TypeScript and JavaScript variants.

| Part | Files |
|---|---|
| Navigation | `app/_layout.tsx` (providers from the glue, Paper theme, auth gate), `app/(tabs)/` bottom tabs, `app/(auth)/sign-in.tsx`, `app/+not-found.tsx` |
| Auth | `src/auth/authGate.ts` (pure redirect rule), `tokenStore.ts` (expo-secure-store), `AuthProvider.tsx` (session, sign in, sign out on 401) |
| API client | `src/api/client.ts`: plain fetch, bearer header, base URL, error mapping, retry of GET. No native imports: it can move to a shared package |
| UI | React Native Paper; `src/ui/StateViews.tsx` loading / empty / error states; 44 pt tap targets |
| Config | `app.json` (scheme `knm`, platforms ios and android, `extra.apiUrl`, `android.package` / `ios.bundleIdentifier` placeholder `com.example.mobile`), `eas.json` (`preview` APK, `production` AAB), `jest.config.js` (jest-expo) |

Registers `AuthProvider` in the scaffold glue `src/app/providers` and the key `EXPO_PUBLIC_API_URL` in `src/app/config`. The API URL is the same as the web app's by default; set `EXPO_PUBLIC_API_URL` (or `extra.apiUrl`) to use another.

**Networking:** `localhost` is the phone itself. In development a `localhost` / `127.0.0.1` URL is pointed at the machine running `expo start` (Expo `hostUri`), so the default works on a real device and the emulators. For an Android emulator without that, use `http://10.0.2.2:<port>`; for a deployed API set the real URL. A real host is never rewritten.

**Builds:** `npm run build:apk` (`eas build --platform android --profile preview`) needs `eas login` and your own bundle identifiers in `app.json`.

Adaptation: the sign-in route (`LOGIN_PATH`, default `/api/auth/login`, answer `{ token }`) in `AuthProvider`, tabs and icons, `app.json` names and identifiers.

Not in this release (later modules): push + local notifications, offline cache and queued writes, Sentry.

## Tests
Contract and fit tests run with Jest (`jest-expo`) and React Native Testing Library. They need the Expo packages installed, so they run in a project with `npm install` done (the app, or the scratch project made by `scripts/verifyExpo.sh`). `npm test` in module-pack checks the module statically and applies it to the mobile fixture.

## Manual check (Expo Go)
1. Apply the module (or generate the project with the `node-fullstack-mobile` preset), `npm install`, `npx expo start`.
2. Open in Expo Go (iOS and Android): sign-in screen appears, a wrong password shows an error, a right one opens the tabs, Settings > Sign out returns to sign-in, a deep link `knm://settings` opens Settings when signed in.
