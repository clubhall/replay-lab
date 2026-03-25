# RF-DETR Service

Local FastAPI service for the blessed ClubHall RF-DETR lane.

## Runtime Modes

- Service readiness is reported by `/api/v1/health` as:
  - `real-ready`: the committed official runner can be used
  - `fixture-only`: runner dependencies are missing, so runs fall back to fixture output unless forced fixture was already requested
- Completed run `runtimeMode` values are:
  - `real`
  - `fixture-forced`
  - `fixture-fallback`

## Setup

Base service dependencies:

```bash
python3 -m pip install -e apps/replay-rfdetr-service[dev]
```

Official runner dependencies:

```bash
python3 -m pip install -e apps/replay-rfdetr-service[runner]
```

Optional model override:

```bash
export CLUBHALL_RFDETR_MODEL_ID=rfdetr-small
```

The default blessed model is `rfdetr-small`. Use `ROBOFLOW_API_KEY` only when the overridden model requires it.

## Run

```bash
PYTHONPATH=apps/replay-rfdetr-service python3 -m uvicorn app.main:app --reload
```

## Benchmarks

The official runner receives a video plus optional time range, extracts frames internally, runs inference per frame, and emits `frames[]` with timestamps for the existing normalizer.

Run:

```bash
pnpm benchmark:rfdetr
pnpm benchmark:rfdetr:compare
```

Interpret benchmark output as:

- `real-ready` + zero `actualMode=real` clips: failing benchmark
- `fixture-only`: environment not ready yet, benchmark is informative and should not fail
- `fixture-fallback`: the real lane was attempted but the service had to fall back to fixture output for that clip
