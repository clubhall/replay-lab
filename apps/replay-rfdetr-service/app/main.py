from __future__ import annotations

import asyncio
from time import perf_counter
from typing import Any
from uuid import uuid4

from fastapi import BackgroundTasks, FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .analysis import generate_fixture_output, normalize_external_output
from .rfdetr_runtime import get_runtime_status, run_runtime
from .schemas import Diagnostics, EngineRequest, EngineRun, EngineRunTarget, HealthResponse, RunResponse, VideoAsset
from .storage import now_iso, persist_upload, resolve_asset_path

app = FastAPI(title="ClubHall Replay RF-DETR Service", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ASSETS: dict[str, VideoAsset] = {}
RUNS: dict[str, EngineRun] = {}
OUTPUTS: dict[str, dict[str, Any]] = {}


def create_run(request: EngineRequest) -> EngineRun:
    timestamp = now_iso()
    runtime_status = get_runtime_status()
    run = EngineRun(
        id=f"run_{uuid4().hex[:12]}",
        engineId=request.engineId,
        engineVersion=runtime_status["label"],
        target=EngineRunTarget(
            assetId=request.assetId,
            sessionId=request.sessionId,
            segmentId=request.segmentId,
            timeRangeMs=request.timeRangeMs,
        ),
        status="queued",
        diagnostics=Diagnostics(
            warnings=[],
            runtimeMode=runtime_status["mode"],
        ),
        createdAt=timestamp,
        updatedAt=timestamp,
    )
    RUNS[run.id] = run
    return run


async def execute_run(run_id: str, request: EngineRequest) -> None:
    run = RUNS[run_id]
    run.status = "running"
    run.updatedAt = now_iso()
    RUNS[run_id] = run

    start = perf_counter()
    warnings: list[str] = []
    runtime_status = get_runtime_status()

    try:
        asset = ASSETS[request.assetId]
        runtime_payload, runtime_warnings, runtime_status = run_runtime(resolve_asset_path(asset), request)
        warnings.extend(runtime_warnings)
        if runtime_payload is None:
            await asyncio.sleep(0.15)
            output = generate_fixture_output(request, warnings=warnings)
        else:
            output = normalize_external_output(request, runtime_payload, runtime_mode=runtime_status["mode"])
            output.diagnostics = {
                **(output.diagnostics or {}),
                "warnings": [*(output.diagnostics or {}).get("warnings", []), *warnings],
            }
    except Exception as exc:  # pragma: no cover - exercised through service tests
        warnings.append(f"Runtime fallback triggered: {exc}")
        output = generate_fixture_output(request, warnings=warnings)
        runtime_status = {
            **runtime_status,
            "mode": "fixture",
            "label": "fixture-rfdetr-v1",
        }

    latency_ms = (perf_counter() - start) * 1000
    diagnostics = {
        **(output.diagnostics or {}),
        "latencyMs": latency_ms,
        "warnings": (output.diagnostics or {}).get("warnings", []),
        "runtimeMode": (output.diagnostics or {}).get("runtimeMode") or runtime_status["mode"],
    }

    run.status = "completed"
    run.engineVersion = runtime_status["label"]
    run.updatedAt = now_iso()
    run.diagnostics = Diagnostics(**diagnostics)
    RUNS[run_id] = run
    OUTPUTS[run_id] = output.model_dump()


@app.get("/api/v1/health", response_model=HealthResponse)
async def get_health() -> HealthResponse:
    return HealthResponse(ok=True, runtime=get_runtime_status())


@app.post("/api/v1/assets", response_model=VideoAsset)
async def register_asset(file: UploadFile) -> VideoAsset:
    asset = await persist_upload(file)
    ASSETS[asset.id] = asset
    return asset


@app.post("/api/v1/runs", response_model=RunResponse)
async def create_analysis_run(request: EngineRequest, background_tasks: BackgroundTasks) -> RunResponse:
    if request.assetId not in ASSETS:
        raise HTTPException(status_code=404, detail=f"Asset {request.assetId} not registered")

    run = create_run(request)
    background_tasks.add_task(execute_run, run.id, request)
    return RunResponse(run=run, output=None)


@app.get("/api/v1/runs/{run_id}", response_model=RunResponse)
async def get_analysis_run(run_id: str) -> RunResponse:
    run = RUNS.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
    return RunResponse(run=run, output=OUTPUTS.get(run_id))
