# ClubHall Replay · Expo

An iPhone-first Replay app in the existing `clubhall/replay-lab` monorepo. The screen opens directly on a playable tennis recording. The original Vite analysis lab remains under `apps/replay-web`.

## Run

From the repository root, with Node 22+ and the pinned pnpm version:

```sh
pnpm install --frozen-lockfile
pnpm dev:ios
```

Open the QR code in a compatible Expo Go client. To launch a local iOS simulator, use `pnpm --filter @clubhall/replay-mobile ios`. The app uses Expo SDK 57. No backend credentials or account are needed.

Browser preview of the same React Native app:

```sh
pnpm build:ios-preview
node scripts/serve-replay-mobile.mjs
```

Open `http://127.0.0.1:5201`. This is the Expo web export, not a separate implementation.

## Verify

```sh
pnpm --filter @clubhall/replay-mobile typecheck
pnpm --filter @clubhall/replay-mobile exec expo export --platform all
pnpm exec playwright test --config playwright.mobile.config.ts
```

The Playwright suite requires an installed Chromium (`pnpm exec playwright install chromium`). `PLAYWRIGHT_CHROMIUM_EXECUTABLE` optionally selects an existing executable. Export the app before running the tests.

See [delivery notes](../../docs/replay-ios/README.md) for architecture, scope and device validation limits.
