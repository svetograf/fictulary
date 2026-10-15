# Auth: native apps (iOS / Android) — postponed

Follow-up to the production auth plan (Google + Apple via our own backend, single 7d JWT).
Web sign-in ships first; this file holds the native-specific work so we can pick it up later.

## Prerequisites (already done for web)
- API endpoints `POST /auth/google`, `POST /auth/apple`, `PATCH /me`, `DELETE /me` exist.
- `@capgo/capacitor-social-login` is used on web, so the client code is shared.
- The API accepts several audiences: `GOOGLE_CLIENT_IDS` (comma list) and both
  `APPLE_BUNDLE_ID` and `APPLE_SERVICES_ID`. Native only adds new values to these.

## Provider console setup (native-only parts)
**Google Cloud** (same project as the web client)
- [ ] OAuth client **iOS**: bundle ID. Note the iOS client ID and its reversed client ID (URL scheme).
- [ ] OAuth client **Android**: package name + SHA-1 of the debug keystore, the release/upload keystore,
      and the Play App Signing key (Play Console → App integrity).
- [ ] Add the iOS client ID to `GOOGLE_CLIENT_IDS` on the API. Android sends tokens issued for the
      **web** client ID (used as `serverClientId`), so it needs no new value.

**Apple Developer**
- [ ] The App ID created for web (Sign in with Apple enabled) becomes the real app bundle ID — confirm it matches.
- [ ] Provisioning profiles for development / distribution with the Sign in with Apple capability.

## Capacitor
- [ ] Add `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/android` to the workspace;
      `capacitor.config.ts` in `apps/web` with `webDir` pointing at the web build output.
- [ ] Nx targets for `cap sync` / `cap open` (check `nx g --help` / Nx docs for a Capacitor plugin before hand-rolling).
- [ ] API base URL for native builds: the app no longer runs behind `proxy.conf.json`, so it needs an absolute
      production URL, and the API needs CORS for `capacitor://localhost` (iOS) and `https://localhost` (Android).

## Social login plugin — native config
- [ ] iOS: enable the **Sign in with Apple** capability in Xcode; add the Google reversed client ID as a URL scheme
      in `Info.plist`; initialize the plugin with the iOS client ID.
- [ ] Android: initialize with `webClientId` (= web client ID, used as server client ID). Apple on Android
      goes through a web flow using the Services ID and its return URL — verify the plugin's Android Apple setup.
- [ ] Apple nonce: same flow as web (raw nonce to API, SHA-256 to Apple).

## Token storage
- [ ] Switch `tokenStorage` (`apps/web/src/app/auth/token-storage.ts`) to `@capacitor/preferences` on native
      (iOS can purge WebView `localStorage`); keep `localStorage` on web. The API is async, so the
      storage interface and `AuthState` init must become async.

## App Store / Play requirements
- [ ] In-app account deletion (`DELETE /me`) reachable from settings — already built for web; confirm it works on device.
- [ ] Apple button follows Apple's HIG and is at least as prominent as Google's (guideline 4.8).
- [ ] Privacy labels / Data safety form: email, name, user content.

## Device testing
- [ ] iOS simulator + real device: Apple and Google sign-in, first sign-in name prompt, re-sign-in, deletion
      (check the Apple ID → "Sign in with Apple" apps list no longer shows the app after deletion).
- [ ] Android emulator + real device with the release-signed build (SHA-1 mismatches only show up there).
- [ ] Account linking: same email via Google on Android and Apple on iOS → one account.
