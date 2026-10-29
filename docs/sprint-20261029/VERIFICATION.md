# Exact-candidate verification

Runtime source: `87b8a038a51918709e2a191b8d74d7eb68d71db5` (29 October 2026). The documentation/evidence commit that contains this file does not change runtime code. Base: `4a9e31d203d7d96ea2329c6ea383691c4ad85324`. Environment: Linux, Node 24.19.0, pinned pnpm 10.4.1, Chromium 145.0.7632.6. All media is synthetic diagnostic footage.

| Check | Result | Evidence |
|---|---|---|
| Unit/domain/server integration suite | 114 passed / 12 files | [test log](evidence/tests-87b8a03.log) |
| Whole workspace typecheck | 31 tasks successful | [typecheck log](evidence/typecheck-87b8a03.log) |
| Changed application lint | pass | [lint log](evidence/lint-87b8a03.log) |
| Whole workspace build | 17 tasks successful | [build log](evidence/build-87b8a03.log) |
| Desktop browser journeys | 5 passed, 38.2 s | [browser log](evidence/browser-87b8a03.log) |
| Responsive Chromium smoke | 390×844, import + render-preview request, zero horizontal overflow and page errors | [measurements](evidence/responsive-chromium.json), [capture](evidence/responsive-chromium.png) |
| WebKit browser runtime | blocked before execution: missing OS libraries; supported dependency installer failed with `su: Authentication failure` | [setup log](evidence/webkit-setup.log) |
| Physical iPhone/native build | not available; not executed | Native source/app/distribution integration is still required |

Desktop browser coverage includes eight distinct source files, two editable day/group values, annotation-preserving reimport, 8/8 actual decoded visual-change indices, reel trim/reordering/reload, playable rendered preview/download and fail-closed missing media. Existing regressions also exercise IndexedDB-to-OPFS fallback, fingerprint relink rejection, point/reward corrections, slow/loop playback, reload and independently decoded single-clip export. A multi-file browser failure exposed prior-video seek events cancelling the next import; the corrected ownership is covered by the eight-file regression.

The server tests render 30 seconds from a blue-with-audio original followed by 30 seconds from a red-without-audio original. The result independently decodes video and audio, verifies output order from pixel values, checks actual transition indexing, tests a Unicode/emoji/percent source label, rejects changed/missing/indirect originals and invalid cuts, and verifies active-render cancellation plus stalled-upload deadline cleanup. No real athlete identification, stroke analysis or coaching accuracy was measured.

- [60-second synthetic reel](evidence/synthetic-60s.mp4), SHA-256 `c9685cd90ca37b0c2149af53ec143d77fa7b07e4a3c82961089676c6bede525b`
- [Source fingerprints, reel manifest and independent FFmpeg decode output](evidence/manifest.json)
- [Desktop batch/reel screenshot](evidence/desktop-batch-reel.png), SHA-256 `089f068f4da83544901983cba28607185f1f239c9d4f6b73cf0a62692b666e0f`

The reviewer identified a real stalled-upload timeout gap; successor `87b8a03` binds the deadline to the request stream and adds a regression that sends one byte then stalls. The Unicode manifest paired decoder is in the source and its regression passes. These checks are source-local, not proof that the integrated CLUBHall app satisfies G2/G3/G4.

The local preview runs via `corepack pnpm --filter replay-coach preview` at `http://127.0.0.1:4175/`. The build and API middleware both use the runtime source above. No public URL, native build, EAS Update, new TestFlight delivery or app-store submission is claimed. Source PR publishing is left to the coordinator; this branch is reviewable without merging unrelated branches.

Known product gaps and all 24 states: [REPLAY.md](REPLAY.md). The inherited Coach shell has not received the canonical bottom arena or the final cream/gold/charcoal composition; screenshots establish functioning controls only, not final aesthetic acceptance. Real tennis footage, approximately 5 GB Sony media, RF-DETR runner, authenticated app media/access integration and physical iPhone playback remain open. Local synchronized comparison was subsequently implemented and verified in runtime `38e1cedf60a2bbe7f4238de1f519e8cee16c4202`; see [comparison follow-up](COMPARISON.md). The evidence above remains tied to its original source SHA.
