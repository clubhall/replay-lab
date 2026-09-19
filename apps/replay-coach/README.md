# Replay Coach — local experiment

A separate, video-first web workspace. The existing Replay web app and unmerged iOS PR remain independent.

## Run

From the repository root, with Node 22+ and pnpm 10:

```sh
pnpm install
pnpm dev:coach
```

Open **http://127.0.0.1:4175/**. `dev:coach` builds the reused workspace packages and installs the platform-specific FFmpeg binary before starting Vite. The first setup requires network access. The export and decision endpoints run in the local Vite server (also supported by `vite preview`); serving `dist` as static files alone does **not** supply these endpoints.

## First session

1. Import a supported local video (H.264 MP4 is the most portable).
2. Identify your player. Set the first server. Only check “todos os pontos desde 0–0” when you are annotating the complete sequence; otherwise the match score remains unavailable.
3. Play, seek, slow to 0.25×/0.5×, and select an A/B interval. Confirm a winner once per interval. Annotate rally contacts only when observed.
4. Eight or more confirmed rally contacts can earn “Ponto construído.” Replaying does not award again. Correct the existing moment’s winner/contacts or reject it; score and XP rebuild from revision history.
5. Coach → pause → drag a rectangle around the selected athlete → detect the real pose in this frame. Selection is **per frame**, not tracking. Playback, seeking and edits invalidate it. Poor visibility or multiple matching bodies produce abstention.
6. “Revisar evidências” currently abstains from technical evaluation: the UI does not yet collect a validated multi-frame window and human contact labels. A single pose is not sufficient. The separately tested knowledge package supports a narrowly grounded observation when those prerequisites are supplied.
7. Guardar → export MP4 renders the chosen range locally, retaining audio when present. Project/composition JSON are separate artifacts and are not videos.
8. Reload and open the session from “Sua coleção.” If browser storage loses the video, reconnect the original; its full SHA-256 content fingerprint must match. Export project JSON for a portable annotation backup.

## Storage and media limits

Videos stay on this computer. Playback uses object URLs; SHA-256 reads 4 MiB chunks rather than a whole-video ArrayBuffer. IndexedDB stores a Blob plus its fingerprint separately from annotations. If that browser cannot serialize Blobs, a streaming OPFS fallback stores the media with fingerprint-bound metadata. Storage failures are surfaced and annotations can be retained with relink. Relinking also works for the current visit when durable media storage is unavailable. Browser storage can be evicted and is not a backup. Large/5 GB files have **not** been validated.

The local export service accepts self-contained media containers, rejects playlists/indirect sources and foreign origins, limits source uploads to 1 GiB, and limits each exported interval to 120 seconds. It re-encodes H.264/AAC and requires nonzero video frames and an output duration within 150 ms of the requested interval. Temporary files are deleted after completion/cancellation. Arbitrary remote deployment or exposure on a LAN is not supported; keep the localhost binding.

MediaPipe uses a CPU worker with runtime `0.10.32` and Lite model `float16/1`. First use fetches pinned runtime/WASM/model assets; it sends no video payload to those hosts. Source/model/license URLs are exported in `src/pose.ts`. Gates are provisional engineering checks, not clinically or scientifically calibrated thresholds. No 3D, ball tracking, automated contact classification, injury inference or validated athlete tracking is exposed.

## Jev

Without a server-side `TYPESAFE_API_KEY`, decisions are explicitly labelled **local fallback**. Optional `TYPESAFE_MODEL` defaults to `jev-latest`. Configure the environment of the local process, never a `VITE_` variable or client code. Do not paste keys into a project file committed to Git.

The adapter follows the typed-action architecture inspected in `accollier/made-for-me` commit `6465a051` (`server/decision-core.mjs`), reimplemented for this workspace. The model can choose only reviewed navigation affordances; it cannot score, create technical claims, run code or export automatically. Request/session/revision checks discard stale replies. Provider failures, malformed distributions, low confidence and deadlines use a labelled fallback. **Authenticated Jev execution has not been validated.**

## Validation

```sh
pnpm test
pnpm typecheck
pnpm build
pnpm --filter replay-coach lint
pnpm --filter @clubhall/coach-game lint
pnpm --filter @clubhall/coach-knowledge lint
pnpm exec playwright install chromium webkit
pnpm e2e:coach
```

The e2e command generates an explicitly synthetic 8-second test-pattern video with sine audio under ignored `tests/coach/generated/`. It is not athlete footage. Browser screenshots and exported test videos go to ignored `test-results/`. Optional `COACH_CHROMIUM_PATH` / `COACH_WEBKIT_PATH` point at an already installed test browser when standard Playwright setup is unavailable.

See the single execution record at [`docs/coach/EXECUTION.md`](../../docs/coach/EXECUTION.md) for exact passes, remaining gaps and runtime limitations. Physical-iPhone testing and Arthur’s real videos are still required before broader claims.
