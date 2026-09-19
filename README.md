# ClubHall Replay

Browser-first replay workspace for long-form tennis video review, overlays, and portable session analysis.

## Watch your match

The default web entry now opens the immersive Replay experience. Choose **Try a sample** for the bundled tennis recording, or **Open match** for your own video. Save a moment, set its range, loop it at 0.5× or 0.25×, and keep a personal takeaway. The arena companion inhabits a separate architectural chamber across Watch, Moments and Practice.

Review milestones reflect saved moments, your marked reviews and notes; they are not automatic scoring or measured tennis ability. Recordings remain on your device. Export replay saves a portable JSON backup of your moments and annotations; it does not render an edited video. The detailed analysis workspace remains accessible from the watching interface.

Build shared packages once before starting only the web app:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm --filter replay-web dev --host 127.0.0.1 --port 5174 --strictPort
```

Open the URL printed by Vite. Shared packages export built files, so rebuild after editing a shared player/store package.

See [implementation and verification notes](docs/immersive-replay.md) and [asset attribution](apps/replay-web/public/assets/README.md). Native iPhone work remains in the separate `codex/replay-ios` branch. This browser change does not establish native device acceptance or a deployed preview.

## Workspaces

- `apps/replay-web`: browser workspace
- `apps/replay-rfdetr-service`: local FastAPI worker for RF-DETR-compatible analysis
- `packages/*`: shared contracts, UI, state, overlays, and engine adapters

## Quick start

```bash
pnpm install
pnpm dev
```

For the local CV worker:

```bash
python3 -m pip install --user fastapi uvicorn python-multipart pydantic httpx pytest
PYTHONPATH=apps/replay-rfdetr-service python3 -m uvicorn app.main:app --reload
```

Run tests:

```bash
pnpm exec vitest run
PYTHONPATH=apps/replay-rfdetr-service python3 -m pytest -s apps/replay-rfdetr-service/tests -q
```

## Benchmark harness

Benchmark fixtures live under `fixtures/`.

```bash
pnpm benchmark:rfdetr
pnpm benchmark:rfdetr:compare
```

The runner reads `fixtures/manifest.json`, uploads any locally available clips, and writes normalized outputs to `fixtures/output/`.

## RF-DETR runtime modes

The worker defaults to fixture fallback. To enable a real external detector lane, set:

```bash
export CLUBHALL_RFDETR_RUNNER=/absolute/path/to/your/rfdetr-runner
export CLUBHALL_RFDETR_RUNNER_ARGS="--your-extra-flags"
```

The configured runner must print JSON to stdout. It can return either normalized `tracks` or frame-level `frames` detections; the service will apply interpolation, smoothing, and exclusion-zone filtering before returning normalized output to the app.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

Report vulnerabilities privately — see [SECURITY.md](SECURITY.md).

## License

MIT — see [LICENSE](LICENSE).
