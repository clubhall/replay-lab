# Replay integration increment — 29 October 2026

This is an independent local Replay increment, not completion of the CLUBHall sprint or native product acceptance. The coordinator owns cross-repository integration. No public deployment, account integration, native build or TestFlight distribution was performed here.

## Bases and reuse

- Owned worktree: `/workspace/worktrees/replay`; branch `codex/replay-sprint-20261029`.
- Base: Replay PR #4 `4a9e31d203d7d96ea2329c6ea383691c4ad85324`.
- Inspected PR #1 `a538853a2f6372ebc2af0e6424252f827d6d544d`: standalone Expo player, second-based `Moment` intervals, `clubhall-replay-ios-v1` storage, separate identity-less session store. Retain for native integration; not mass-merged.
- Inspected PR #3 `4dd8e7a90c3f74ec9f6e78a6f26d2351c3f30673`: immersive WatchPage, shared player ergonomics, timeline thumbnails, arena composition. Retain source references; this branch does not certify that proposed arena as canonical.
- Reused PR #4: millisecond-based `coach/v1`, immutable point events, manual corrections, fingerprints, IndexedDB/OPFS, per-frame MediaPipe, original clip export and typed Jev fallback. Existing `clip-manifest/v1` remains a single-source contract. New `reel/v1` explicitly permits ordered multiple originals and revisioned cuts.
- Existing RF-DETR runtime (`apps/replay-rfdetr-service/app/rfdetr_runtime.py`) requires `CLUBHALL_RFDETR_RUNNER`; none is configured in this environment. Its fallback is fixture data and is not used as measured athlete evidence.

## What changed

Batch import processes files sequentially, fingerprints originals and skips already available media without overwriting annotation history. Failed/cancelled files remain visible in the batch outcome; reselecting the batch resumes through deduplication. Sessions have editable group/day metadata and restore the paused playhead. Playback includes 0.25×, 0.5×, 1× and 1.5×; hiding the page pauses the main player.

The optional `visual-change/v1` index decodes actual media with FFmpeg, samples 2 frames/s at 32×18 luma, and proposes intervals around mean absolute image differences above 0.08. It records the source fingerprint, run ID, sample rate and measured coverage. It processes at most the first 120 seconds. Batch completion persists after each source; reanalysis preserves independently stored review notes/rejections. This detects visual transitions only. It does not identify tennis shots, winners, athlete identity or technical errors. Thresholds are uncalibrated on real tennis footage and are explicitly described in the UI.

The reel editor stores independent cuts, supports trim/remove/reorder and persists a revisioned selection. Render snapshots cannot silently lose a missing source. Each render streams the referenced original bytes once into private temporary files, checks SHA-256, rejects indirect media and nonlocal origins, normalizes 720p/30fps H.264/AAC with 16:9 contain, adds silence to originals without audio and verifies the decoded result. Preview and download use the same output Blob/revision. Cancellation preserves selection and removes temporary files. Local limits remain eight distinct sources, 32 cuts, 1 GiB total original bytes and 120 seconds total selected duration. These are explicit experiment limits, not a 5 GB production promise.

The source and original clip paths remain local to this machine. Browser storage may be evicted. Selection JSON does not contain media. No share URL or new authenticated media service is fabricated.

## Task status and next action

| Task | Verified local increment / remaining acceptance |
|---|---|
| T-R01 | PR lineages inspected; explicit multiasset `reel/v1` and legacy `coach/v1` defaults preserve old sessions. Full native/immersive/shared-app adapter and canonical identity/access reconciliation remain open. |
| T-R02 | Eight distinct synthetic originals, retry deduplication, editable two-day grouping, persistent annotations and missing-source recovery tested in Chromium. Real footage, storage eviction/interrupted large imports and resumable remote transport remain open. |
| T-R03 | Existing player/point review reused; 1.5× and paused playhead restoration added. Full History/Statistics/Highlights/Coach Summary composition, touch-specific chapters and canonical persistent arena remain open, dependent on C01–C03/native integration. |
| T-R04 | Real decoded visual-transition candidates, provenance, batch review and correction persistence implemented. RF-DETR runner unavailable; no labeled athlete footage or validated tracking/shot analysis. Visual changes do not close sporting-analysis acceptance. |
| T-R05 | Non-destructive cross-video cut ordering, trim, immutable render revision, exact rendered preview and fail-closed missing-source handling. Unified native favorite/tag adapters remain open. |
| T-R06 | 60-second two-original synthetic reel independently decoded as H.264/AAC, order verified from output pixels; browser renders/downloads/plays multiasset output. Physical-iPhone playback and actual footage/audio/crop acceptance remain open. |
| T-R07 | Explicit resource limits, invalid intervals/indirect sources/fingerprint changes and cancellation checked. Arthur's approximately 5 GB Sony source is unavailable; no large-source/proxy infrastructure claim. |
| T-R08 | Blocked on canonical app identity/access/activity integration. Local app has no login. No second login introduced. Revocable shared links and actual next-practice backend are not implemented here. |
| T-R09 | Coverage below. Actual athlete task timing, synchronized two-video comparison and shared-duration offset playback remain implementation work; they are not completed by synthetic tests. |

## All 24 detailed states

“Local” below means the Coach browser runtime. Native and integrated CLUBHall acceptance remain separate.

| State | Evidence/status |
|---|---|
| 01 empty library | Existing local empty state; browser regression. |
| 02 library | IndexedDB collection and reload; browser regression. |
| 03 add sources | Multiple file input; eight-source browser run. |
| 04 selected batch | Sequential progress/outcome; explicit reselect-to-resume; no hidden concatenation. |
| 05 organize sessions | Editable group/day persisted; two-day browser check. |
| 06 identify athlete | Existing manual description and per-frame ROI; no face/tracking identity claim. |
| 07 uploading | Local storage/hash progress; server analysis/render transfers are local only. Remote resumable upload absent. |
| 08 preparation/partial | Completed batch entries persist individually; missing sources remain explicit. |
| 09 interrupted | Explicit cancellation, render cleanup, saved selection and deduplication; process-crash recovery partially covered by stored state only. |
| 10 ready session | Real media decode/player with original relink. |
| 11 moment | Existing confirmed/manual point intervals and playback. |
| 12 moments list | Existing point list plus visual-transition candidates, each tied to original time. |
| 13 search | Typed local navigation commands exist; semantic sporting-moment search absent. |
| 14 correction | Existing point revisions and independent visual-candidate review notes/rejection. |
| 15 trim | Numeric original interval and independent reel cuts. |
| 16 selection | Persistent ordered multiasset selection. Unified favorites adapter open. |
| 17 composition | Explicit reel order/revision with per-source fingerprints. |
| 18 final preview | Actual rendered MP4 used for preview and download. |
| 19 export | Local H.264/AAC clip/reel output, decoded synthetic verification. Physical phone open. |
| 20 destination/access | Local download only. Shared identity, grants/revocation and destinations absent. |
| 21 received moment | Not implemented; requires authenticated shared-media access. |
| 22 insight | Manual evidence and explicit abstention; visual transition score is not athletic insight. |
| 23 next practice | Authored knowledge package exists; integrated practice commitment not implemented. |
| 24 comparison | Not implemented; synchronized reference-point/offset comparison still required. |

## Resume and verification

Use Node 22+ and the pinned pnpm 10.4.1 via `corepack pnpm`. The environment's default pnpm was version 11 and inserted invalid `allowBuilds` placeholders; that unintended file edit was removed. If Turbo resolves that global pnpm, put a local executable shim containing `exec corepack pnpm "$@"` first on PATH. Do not change the repository lockfile to accommodate the environment.

```
corepack pnpm install --frozen-lockfile
corepack pnpm prepare:coach
corepack pnpm test
corepack pnpm typecheck
corepack pnpm --filter replay-coach lint
corepack pnpm build
corepack pnpm fixture:coach
corepack pnpm exec playwright test --config=playwright.coach.config.ts --project=coach-desktop
corepack pnpm --filter replay-coach preview
```

Preview URL is `http://127.0.0.1:4175/`. It needs the local Vite server's API middleware; a static upload of `dist/` does not provide analysis/rendering. Keep it bound to localhost until per-user media authorization and hosted resource controls are integrated.

All media used for this increment is generated synthetic diagnostic footage. `test-results/reel/synthetic-60s.mp4` and its JSON hash/decode report are generated by the integration test. `test-results/coach/` contains browser download/screenshot artifacts. They do not prove tennis perception accuracy or physical iPhone support. Exact commit/log evidence is maintained in `VERIFICATION.md` after the final run.
