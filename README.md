# ClubHall Replay

Browser-first replay workspace for long-form tennis video review, overlays, and portable session analysis.

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
