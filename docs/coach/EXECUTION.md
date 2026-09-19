# Replay Coach — execution record

Date: 2026-09-19. This is the single implementation record for the handoff in this directory.

Validated implementation commit: `a28c8da8a05b72c8071f098cb9dc2df0155bdf26`. The following documentation-only commit adds this record and screenshots; it does not change runtime code.

## Base and reconciliation (C01)

- Plan branch: `codex/replay-coach-plan-20260919`, `4db2e34fec7c5b314103ea6aa7def3586e91016a`.
- Verified main: `8e7991e22c1eda048484560a8e142a60f2a759e0`.
- Verified open iOS PR #1: `codex/replay-ios`, `a538853a2f6372ebc2af0e6424252f827d6d544d`.
- Integration branch: `codex/replay-coach-runtime-20260919`, based directly on the plan. No existing PR merged and no production deployment changed.
- The iOS PR adds an Expo workspace and browser/native storage/share adapters. Its browser Blob persistence and explicit missing-media flow informed this implementation. It does not provide rendered highlight export, so importing the whole native branch would add dependencies without closing that gap.
- Added `apps/replay-coach`; reused `@clubhall/video-domain` IDs and `@clubhall/ffmpeg-tools` composition manifest. Existing box-derived pose and RF-DETR fixture fallbacks are not used for coach evidence. Analysis contracts remain compatible.
- Inspected Jev decision core at `accollier/made-for-me@6465a051`; used its typed allowlist, deadline, probability validation and local-fallback discipline for a new bounded adapter. No provider key was read or published.

## Project environment

Argent environment inspection: React web monorepo, not React Native/native iOS/native Android on this branch. Node 24.16.0, pnpm 10.4.1, React 19.2.4, Vite 8.0.2, TypeScript 5.9.3. Local start: `pnpm dev:coach`, port 4175. Worker CPU inference; FFmpeg platform binary for local H.264/AAC rendering. The existing Replay dev/preview commands remain separate.

## Implemented round

| Area | Current implementation | Boundary |
| --- | --- | --- |
| C02 contracts | Versioned session schema, confirmed/inferred/demo/rejected events, evidence identities, action allowlist, session/revision validation | No cross-device backend sync |
| C03 playback | Real local import, play/pause, seek, slow, loop A/B, player description | Per-frame ROI selection; no automatic player tracking |
| C04 storage | IndexedDB session + fingerprint-bound Blob, streaming OPFS fallback, chunked full SHA-256, JSON import/export, explicit relink and quota failure | Browser storage may be evicted; 5 GB case not tested |
| C05 scoring | Advantage games, best-of-three, 6–6 tie-break, service order, gaps/checkpoints in domain, correction history, denominators | UI supports start-at-love confirmation or partial annotations; no alternate rules |
| C06 rewards | Deterministic badges and ledger grants/revocations; duplicate interval confirmation blocked; contacts editable | First-review domain contract exists but UI does not claim global athlete progress |
| C07 knowledge | Versioned primary-source collection, identity/quality/phase gates, one supported evidence-linked observation and authored drill | Tests are fabricated contract evidence, not proof of coaching accuracy |
| C08 perception | Actual pinned MediaPipe worker, 33 landmarks, source geometry, selected ROI, quality/ambiguity abstention, cancellation | Only a paused frame; negative fixture runtime verified, positive athlete accuracy not tested |
| C09 coach | Visible insufficient-evidence response; no fabricated correction | UI does not yet supply temporal evidence or contact marks; no personalized technical coaching claim |
| C10 comparison | Not implemented | Needs comparable temporal evidence and real athlete footage; no 3D claim |
| C11 Jev | Local labelled commands execute shared seek/slow/loop/clip-preparation actions; server adapter validates provider choices | Authenticated request untested; keys optional and server-only |
| C12 export | Real MP4 re-encode, optional original audio, cancellation, bounded inputs, indirect-media rejection, nonempty/duration validation | Localhost server required; source ≤1 GiB and selection ≤120 seconds |
| C13 training loop | Correctable point rewards and review navigation | No completed-drill or improvement claim; comparison/mission UI pending |
| C14 validation | Unit/domain tests, builds, typechecks, independent reviews, browser tests below | Physical iPhone, actual tennis dataset and qualified-coach review pending |

The UI does not invent the missing approved arena/companion geometry. The video remains the main surface; the companion/3D directions need their actual asset and a later increment.

## Validation results

- **PASS:** `pnpm test`: 106 tests across 9 files. Scoring, revisions, demo isolation, denominators, idempotent ledger, knowledge abstention/identity/quality, pose selection/lifecycle, actions and session provenance.
- **PASS:** `pnpm typecheck`: all 31 build/typecheck tasks.
- **PASS:** `pnpm build`: all 17 workspace builds, including existing Replay web.
- **PASS:** scoped lint on the new app and both new packages.
- **EXISTING FAILURES:** repository `pnpm lint` reports seven errors in unchanged `engine-pose-abstraction`, `engine-lfm-webgpu`, `engine-rfdetr-client` and `replay-player`. These are async-without-await, unsafe JSON assignments and unbound-method errors. They were not silently suppressed or mixed into the coach change.
- Root `test` now runs the existing root Vitest suite once. The inherited Turbo-per-package test command attempted packages with no tests and interrupted workers; it was not a usable full-suite gate.
- **PASS:** actual MediaPipe CPU runtime in Chromium: pinned CDN/WASM/model initialized and returned `no-pose`, `detectedPoseCount:0`, `landmarks:null` on an 8-second synthetic 640×360 test pattern. Direct inference 1,473 ms; full UI selection/detection 1,320 ms. These are individual runs, not a benchmark percentile. Observed external model/runtime requests were GET without video payload.
- **PASS:** desktop browser flow imports actual generated media, confirms points, refuses duplicate interval rewards, revokes/restores corrected XP, slows/seeks/loops, abstains from unsupported coaching, reloads annotations and video, exports H.264/AAC and re-imports/plays the actual downloaded 2-second MP4. Security requests reject out-of-range cuts, malformed/foreign origins and HLS indirect local sources.
- **MOBILE STORAGE LIMITATION:** pinned Playwright WebKit 26.0 revision 2248 rejects every Blob/File IDB write, including a 4-byte Blob, with `UnknownError: Error preparing Blob/File data to be stored in object store`. Its OPFS `getDirectory()` also fails with `UnknownError`; small ArrayBuffers and annotation objects work. This is not evidence of a quota failure. The app displays the actual error, recovers annotations, asks for the original and permits playback after a fingerprint-checked relink. It does not buffer whole videos to evade the runtime limitation.
- **PASS:** final browser suite: 7 passed, 1 explicitly skipped, 18.0 s. Chromium passed all four tests, including forced IndexedDB Blob failure followed by streamed OPFS storage and successful reload. Mobile WebKit passed all three applicable tests, including annotation recovery, wrong-fingerprint rejection, retry with the same original file, relink, actual exported-file playback and zero horizontal overflow. Its OPFS positive-storage test is skipped because this runtime cannot open OPFS. Desktop and mobile screenshots were visually inspected.
- Screenshot evidence uses only generated test-pattern video: [desktop](evidence/desktop-synthetic.png), [mobile WebKit](evidence/mobile-synthetic.png), [real model returning no pose](evidence/pose-negative-synthetic.png). These images establish runtime/UI behavior, not tennis perception accuracy.
- Browser setup: Playwright 1.58.2 installer extraction stalled after completed downloads. Chromium testing used the available headless-shell revision 1234 via `COACH_CHROMIUM_PATH`; WebKit used the exact downloaded revision 2248 archive extracted into a temporary folder via `COACH_WEBKIT_PATH`. These are desktop/mobile browser emulations, not physical-device acceptance.
- iOS simulator Safari was opened but a pre-existing app-link modal obstructed further device validation. No native/device flow is marked as passed; only the session's scoped Argent servers were stopped.

Independent reviews found and fixed duplicate point rewards, immutable UI rally counts, hidden score gaps, partial-session break-point badges, stale media loads, missing fingerprint binding, invalid revision values, stale pose overlays, source-letterboxing mismatch, indirect HLS file reads, malformed origins and zero-frame exports, same-file relink retries and WebKit native-file-control horizontal overflow. Tests cover the corresponding contracts; browser checks exercise real rendered media.

## Remaining acceptance gates

Arthur’s footage was not present. No private videos were fetched or committed. All generated media is ignored and explicitly synthetic. A real positive body sample, person switching/occlusion dataset, temporal phase labels, qualified tennis-coach review, clip comparison, physical Safari/iPhone download/share and 5 GB stress validation remain **not executed**. No TestFlight build, clinical/biomechanical accuracy, authenticated Jev result or engine superiority is claimed.

Next implementation increment: ingest authorized forehand/backhand/serve clips; verify per-frame body detection and identity; persist a selected temporal evidence window with human phase/contact marks; connect the narrow supported observation/drill and comparison UI. Keep absence of evidence visible throughout.
