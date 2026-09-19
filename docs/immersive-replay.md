# Immersive Replay — reconciliation and implementation brief

Source: `clubhall/replay-lab`, main `8e7991e`. The separate arena correction in `accollier/made-for-me#2` informs the spatial direction; this implementation belongs to Replay and does not close that issue or approve its design.

## Implemented
Browser video import, OPFS/IndexedDB session persistence, relinking, segments, overlay inspection, timeline navigation, JSON portability, structured worker contracts, benchmark scripts and fixture metadata already exist.

## Partially implemented
The RF-DETR lane needs a configured external runner for real analysis. The manifest has four entries but the local clips are absent. The current player lacks speed and looping controls. The visual interface primarily exposes technical analysis tools.

## Missing
An accessible, responsive watching surface that makes actual footage the focus, a spatial arena companion, quick moment collection, slow-motion review and clearly grounded review rewards. No user match is attached to this task.

## Conflicts with PLAN.md
No new analysis engine or package is needed. The user's immediate direction prioritizes the watching experience within Milestone 1. Do not present fixture tracks, coaching prompts or review milestones as measured skill, biomechanics or automatic scoring.

## Resource adoption matrix
- Existing Replay store/player/domain/timeline: reuse directly.
- Existing iOS PR sample clip: adapt as explicitly labeled sample footage, with source attribution.
- Made for Me arena geometry/court reference: reuse owned project artwork, adapt environment through depth, lighting and a separate chamber.
- Lawn: reference interaction principles already captured in PLAN.md; no code copied.
- Mux: defer; local video remains useful without cloud infrastructure.
- RF-DETR, Roboflow Inference/Trackers/Sports: preserve current contracts; defer new model integration to measured Milestone 2 work.
- LFM and pose: leave untouched; no fabricated intelligence.

## Delete / Keep / Defer
Delete no existing product foundation. Keep the analysis workspace accessible at `/lab` and `/session/:id`. Make the watching surface the entry point, sharing persisted sessions at `/watch/:id`. Defer cloud deployment, automated scoring, biomechanics and real coaching inference from this UI iteration.

## Milestones 0–2 execution proposal
0. Reuse benchmark harness and metadata; add the existing sample clip for playback verification, without treating it as detector benchmark completion. Remaining benchmark footage still needs curation.
1. Build the watch surface, real import/sample playback, seek/speed/loop, moment editing, reflection notes and review milestones; preserve export/import/relink and the detailed analysis workspace. Verify desktop, compact phone, persistence and actual media changes.
2. Keep the external RF-DETR path available in the analysis workspace; next measure configured real detector results on curated tennis clips before surfacing confident coaching claims.

## File action list
Modify `apps/replay-web/src/App.tsx` routes and existing session linkage, and `packages/replay-player/src/index.tsx` through optional compatibility props. Fix resume persistence in `packages/replay-store/src/index.ts` if needed by validation. Update existing e2e expectations and README.
Create `apps/replay-web/src/WatchPage.tsx`, `watch.css`, a small arena component, app-local assets, focused playback/review tests and this design/evidence document.
Leave worker, inference adapters, normalized schemas and existing analysis functionality untouched.

## Project environment
Browser-first React 19/Vite 8; not React Native or native iOS/Android in this checkout. pnpm 10.4.1, Node 24.16.0. Run `pnpm build` before starting only the web app, then `pnpm --filter replay-web dev --host 127.0.0.1 --port 5174 --strictPort`. Checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, Playwright with the small sample video. Argent environment inspection completed September 19, 2026.

## Design direction and intended deviations
The generated [design study](../design/replay-concept.png) establishes the composition; it is an implementation reference, not user approval. Warm ivory shell, a large unobstructed video, a horizontal moment collection, and a separate limestone arena chamber. The arena artwork, room, grounded shadow, light response and breathing motion are independent layers. Its environment remains mounted across Watch, Moments and Practice; reduced motion removes ambient animation.

Functional additions to the study: a clearly labeled sample entry, a collection control instead of an invented profile avatar, a link to the preserved analysis workspace, JSON backup controls and accessible locked/unlocked states. Saved moment thumbnails come from the actual recording. The welcome court is concept artwork and is labeled as such. No controls or text are embedded in a screenshot.

The existing root `pnpm test` ran Vitest inside each package with root-relative include patterns and discovered no tests. It now invokes the root Vitest suite once, covering all existing tests and new shared-player regressions.

## Rendered design comparison

Compared the [generated composition](../design/replay-concept.png) with the settled [welcome](evidence/replay-welcome.png), [playing workspace](evidence/replay-moment.png), and [390px phone](evidence/replay-mobile.png) renders. Visual approval remains with the user.

| Design point | Implemented result |
| --- | --- |
| Footage owns the largest surface | Preserved: widescreen video fills roughly two thirds of the desktop content; controls and saved moments sit below it. |
| Arena has its own environment | Preserved: a separate limestone room, skylight, floor, grounded shadow and independent arena layer establish depth. The room remains visible across Watch, Moments and Practice. |
| Warm restrained materials | Preserved: ivory canvas, graphite text and thin champagne accents; the supplied arena artwork remains recognizable. |
| Welcome court composition | Intentional difference: the existing portrait court artwork is cropped into the media surface, showing less sky than the generated study. It is labeled concept scenery and replaced by actual imported footage. |
| Controls represent available actions | Implemented: unavailable media controls are disabled; saved cards use decoded video frames. The collection control replaces the study's invented avatar. |
| Learning and enjoyment | Implemented through repeatable ranges, slow motion, personal takeaways and milestones tied to actual saved or reviewed moments. No invented scores or automated judgments. |
| Phone adaptation | Implemented as a single column with a compact two-row control layout and a separate chamber below the player. No horizontal overflow at 390px; 375px was also inspected manually. |
| Motion | Arena motion and lighting are separate from the video. Reduced-motion preference removes ambient animation. |

## Verification — September 19, 2026

- `pnpm build`: passed.
- `pnpm test`: 17 tests passed across six files.
- `pnpm typecheck`: passed across 26 tasks.
- `pnpm exec playwright test`: six browser regressions passed. This machine used its existing Chromium via `PLAYWRIGHT_CHROMIUM_EXECUTABLE`; the override is optional for other machines.
- Scoped lint for the new watching UI and touched player/store/timeline code: no errors; the timeline retains an existing Fast Refresh warning.
- Full `pnpm lint`: blocked by existing errors in legacy `App.tsx` async handlers, `engine-pose-abstraction` and `engine-rfdetr-client`. This change does not claim a clean repository-wide lint baseline.

Browser regressions exercise actual media advance, pause, seek and playback rate; native media looping inside a saved 2–4 second range; editing and reloading moment names and notes; original-file import when OPFS is unavailable, reload and fingerprint-checked relinking; reviewed-state persistence and JSON export; and the 390px reduced-motion layout. The regression exposed a premature “Reviewed” acknowledgment: the UI now keeps “Saving review…” visible until persistence completes.

Shared unit regressions cover the player's rate/seek/loop/source lifecycle and thumbnail metadata/decoded-frame timing. Persistence fixes stage document changes before awaiting storage and preserve sessions when their local video is unavailable.

Evidence: [desktop welcome](evidence/replay-welcome.png), [desktop saved moment](evidence/replay-moment.png), [phone](evidence/replay-mobile.png), [recorded loop/edit/reload workflow](evidence/replay-interaction.webm). Desktop screenshots are 1536×1024 and wait for loaded assets and decoded video. Manual in-app browser checks also covered sample import, save/edit, half speed, looping, reviewed state and reload.

## Remaining product boundaries

The user's match was not attached, so acceptance uses an explicitly labeled 11.8-second sample. Long match storage/performance, device-specific codecs and physical phone behavior still need acceptance with real footage. JSON export backs up the session and annotations; it does not render a highlights video. Automated scoring and coaching inference remain separate work. This iteration is a local browser preview, with no public deployment or native release. The separate Made for Me arena issue remains open and unapproved.
