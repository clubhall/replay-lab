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
