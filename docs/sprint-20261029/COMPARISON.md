# T-R09 / detailed state 24 — synchronized local comparison

Runtime source: `38e1cedf60a2bbe7f4238de1f519e8cee16c4202`. Base of this increment: `6154b06ecc31a8a3410e92e4beedcca60487920b`; implementation checkpoint `ad959f42ad8554b816d761487021768f959a3391`, followed by reviewed lifecycle fixes in the runtime source above. Same isolated Replay worktree and branch. This is T-R09, not T-R08: shared app identity/access/practice integration remains open.

The comparison panel uses existing Coach sessions and IndexedDB/OPFS media. The user selects two originals and one reference time in each. The shared window aligns the reference instants and excludes time absent from either source. For two eight-second sources, A=1 s / B=3 s gives A[0,6] and B[2,8], a six-second shared window and +2 s offset. Negative offsets and unequal durations are supported. Bounds use decoded video metadata; invalid reference times disable playback.

Both players share play/pause, a numeric-labelled slider and “Ir às referências.” The running clock corrects drift above 80 ms; this is a browser playback comparison, not a frame-locked scientific measurement. Pause snaps both decoded players to the same shared position. At the shorter shared endpoint both stop. Selected source fingerprints, reference times and paused position persist across reload. A changed/missing original fails closed; the user reconnects it through the existing collection and reloads the pair. Changing sources/unmounting pauses detached players and revokes object URLs. Playback audio is explicitly muted.

Coverage, offset, source dates, manual athlete descriptions and groups are visible. The UI warns that two videos alone do not establish improvement; athlete identity, camera, task and sample comparability require human review. No athletic automatic judgment, pose superiority, new identity system or remote sharing was introduced. The main player, batch review and reel export remain intact.

## Failure review

Independent review found a genuine startup gap: A could start while B's `play()` promise stalled, leaving no pause/cancel affordance. The final implementation immediately shows a cancelable pending state, bounds startup to two seconds and pauses/resets both on denial or deadline. Generation and per-player ownership checks prevent a late completion from restarting a cancelled or failed run, while preserving a newer successful retry. A failed second-source load releases the first source's object URL immediately.

The browser regression deliberately injects pending/rejected native play promises to test cancellation, timeout, cancel → successful retry → old completion, and cancel → failed retry → old completion. These are controlled failure injections, distinct from the real decoded-media playback path. The reviewer reproduced the initial failure and verified its fix independently.

## Evidence

The final combined check results and exact-commit logs are stored alongside this document under `evidence/*-38e1ced.log`. The targeted browser path uses actual synthetic MP4 files and checks +2 s alignment while playing (within 100 ms), pause/resume, exact shared endpoint, reload, invalid bounds, changed fingerprint, missing original and the startup failures above. Unit tests separately verify positive/negative offsets, unequal source durations, clamping and nonfinite/unsupported inputs. The independent reviewer also exercised A=3 s / B=1 s on Chromium at390×844, including pause/reload and zero horizontal overflow.

Physical iPhone/Safari, real athlete footage and measured athletic comparison remain unverified. The environment's WebKit OS-dependency blocker is unchanged. Local preview remains `http://127.0.0.1:4175/`; the coordinator owns publishing any source-equivalent update to draft PR5. No remote push was performed by this worker.

Final exact-runtime combined verification passed: **117 tests across13 files**, all **31 workspace typecheck tasks**, all **17 builds**, scoped Coach lint and **six desktop browser journeys (30.0 s)**. See [tests](evidence/tests-38e1ced.log), [typecheck](evidence/typecheck-38e1ced.log), [build](evidence/build-38e1ced.log), [lint](evidence/lint-38e1ced.log), [browser run](evidence/browser-38e1ced.log), [aligned reference screenshot](evidence/comparison-aligned.png) and [independent review](evidence/comparison-review.md). The reference screenshot visibly decodes A1.000s/frame30 beside B3.000s/frame90; no athlete media is included.
