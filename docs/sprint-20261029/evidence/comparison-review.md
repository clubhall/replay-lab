# Replay comparison increment review — 2026-10-29

Scope: read-only review of `ComparisonPanel.tsx` and `comparison.ts`, introduced at `ad959f42ad8554b816d761487021768f959a3391`. Worker lint/browser changes were still uncommitted during the first probes; their diff statistics are recorded in each JSON receipt. This report does not claim those probes were against a clean immutable commit.

## Established behavior

- Independently ran the comparison arithmetic suite: 3 tests passed. Positive and negative offsets retain only shared source coverage; references and times are finite and bounded.
- Independently exercised actual Chromium media at 390px: two generated 8-second MP4s, A reference3s/B reference1s, playback, pause and reload. Before pause snapping, measured drift was37ms; the subsequent implementation snaps both paused frames exactly to the same shared position. No horizontal overflow or page errors. These are synthetic timing checks, not a tennis or physical-device evaluation.
- Source inspection confirms persisted source session/fingerprint references, missing-source failure, decoded-duration validation, explicit muted playback, shared-coverage disclosure and a warning that two videos alone do not establish improvement. Import/relink performs source hashing; this component reuses that local media ownership model.

## Findings and verification

1. **Confirmed startup cancellation defect:** if B’s play promise stayed pending, A advanced alone while the UI still offered Reproduce without Pause/cancel. The reviewer controlled B’s pending promise while A used native Chromium playback: A1.183s/B0 after1.2s. Source-clear cleanup worked. `comparison-startup-probe.json` records the initial failure.
2. **Confirmed late completion after failed retry:** the first delayed start was cancelled, a newer start rejected, then the first completed and restarted B despite the UI being paused. The initial ownership guard preserved the old continuation whenever a newer owner existed, even after that owner had failed. `comparison-late-start-probe.json` records the controlled deferred-start failure. Fixed in `38e1cedf60a2bbe7f4238de1f519e8cee16c4202`; the reviewer reran the same controlled failure against that clean commit and both videos remained paused.
3. Failed paired-media loading retained an already-created first object URL until later cleanup. The worker added immediate failure cleanup during review.

A suspected stale rendered frame was retracted after capturing the full640px decoded frame: its burned-in3.600s timestamp matched currentTime3.611s. The tiny screenshot had been misread. This is not counted as a defect.

## Boundary

Comparison state24 is a partial local implementation. Shared CLUBHall identity/access, native navigation, physical iPhone controls/playback, real athlete footage and comparable cross-session conclusions remain unverified. No performance or sports improvement claim follows from these generated sources. Final runtime `38e1cedf60a2bbe7f4238de1f519e8cee16c4202` resolves the bounded review findings; state24/T-R09 remains partial. T-R08 (shared identity/access/deep links/practice) is unchanged and open.

## Exact final candidate

At clean source `38e1cedf60a2bbe7f4238de1f519e8cee16c4202`, the reviewer independently reran:

- `comparison-startup-fixed.py`: controlled stalled B exposes Cancel; explicit cancellation pauses both; retry with continued stall reaches the2s deadline and pauses both; source clear removes both players.
- `comparison-late-start-fixed.py`: first start cancelled → newer start rejected → old start fulfilled; both players remain paused (B advanced less than1ms during its controlled native-start continuation before the guard paused it).
- `comparison-negative-offset-probe.py`: actual generated MP4 playback with A3s/B1s references; pause A3.617527/B1.617527; reload restores exactly those times, no pageerrors or390px horizontal overflow.

Corresponding JSON receipts record the exact clean SHA. The original controlled failures remain separately preserved. `comparison-evidence-manifest.json` hashes the final receipts and screenshots. The decoded-frame inspection used a worker development window and is supporting diagnostics, not relabelled as exact-final evidence.

Worker additionally reports its targeted browser flow passed positive-offset playback/resume/shared-end/reload, rejection/stall/cancel, successful and failed retry with old fulfillment, bad stored fingerprint and missing-media refusal at the same runtime; scoped typecheck/lint pass. Those are worker-run results, not independently reproduced in full here. Combined regressions were still running at this report update.

No additional blocking issue remains in this bounded local comparison review. This does not complete T-R09’s real-footage usability and broader24-state requirements, T-R08 integration, or the full sprint.
