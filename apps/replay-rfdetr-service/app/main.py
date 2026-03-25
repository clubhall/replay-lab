from __future__ import annotations

import asyncio
from uuid import uuid4
from time import perf_counter
from typing import Any

from fastapi import BackgroundTasks, FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .analysis import generate_fixture_output
from .schemas import Diagnostics, EngineRequest, EngineRun, EngineRunTarget, RunResponse, VideoAsset
from .storage import now_iso, persist_upload

app = FastAPI(title="ClubHall Replay RF-DETR Service", version="0.1.0")
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
    run = EngineRun(
        id=f"run_{uuid4().hex[:12]}",
        engineId=request.engineId,
        engineVersion="fixture-rfdetr-v1",
        target=EngineRunTarget(
            assetId=request.assetId,
            sessionId=request.sessionId,
            segmentId=request.segmentId,
            timeRangeMs=request.timeRangeMs,
        ),
        status="queued",
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
    await asyncio.sleep(0.2)
    output = generate_fixture_output(request)
    latency_ms = (perf_counter() - start) * 1000

    run.status = "completed"
    run.updatedAt = now_iso()
    run.diagnostics = Diagnostics(
        latencyMs=latency_ms,
        warnings=output.diagnostics.get("warnings", []) if output.diagnostics else [],
        meanConfidence=output.diagnostics.get("meanConfidence") if output.diagnostics else None,
    )
    RUNS[run_id] = run
    OUTPUTS[run_id] = output.model_dump()


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

