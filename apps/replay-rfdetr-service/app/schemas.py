from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class EngineRequest(BaseModel):
    version: Literal["v1"]
    engineId: str
    sessionId: str
    assetId: str
    segmentId: str | None = None
    timeRangeMs: tuple[float, float] | None = None
    options: dict[str, Any] = Field(default_factory=dict)


class Diagnostics(BaseModel):
    latencyMs: float | None = None
    warnings: list[str] = Field(default_factory=list)
    meanConfidence: float | None = None
    error: str | None = None
    runtimeMode: str | None = None
    frameCount: int | None = None
    detectionCount: int | None = None
    smoothingApplied: bool | None = None
    interpolationApplied: bool | None = None
    exclusionZoneCount: int | None = None


class EngineRunTarget(BaseModel):
    assetId: str
    sessionId: str
    segmentId: str | None = None
    timeRangeMs: tuple[float, float] | None = None


class EngineRun(BaseModel):
    id: str
    engineId: str
    engineVersion: str
    target: EngineRunTarget
    status: Literal["queued", "running", "completed", "failed"]
    diagnostics: Diagnostics | None = None
    createdAt: str
    updatedAt: str


class VideoStorage(BaseModel):
    kind: Literal["external", "opfs"] = "external"
    fileName: str | None = None
    relinkRequired: bool = True
    opfsPath: str | None = None


class VideoAsset(BaseModel):
    id: str
    fingerprint: str
    name: str
    mimeType: str
    sizeBytes: int
    durationMs: float | None = None
    width: int | None = None
    height: int | None = None
    createdAt: str
    updatedAt: str
    storage: VideoStorage


class EngineOutput(BaseModel):
    segments: list[dict[str, Any]] | None = None
    tracks: list[dict[str, Any]] | None = None
    poseFrames: list[dict[str, Any]] | None = None
    insights: list[dict[str, Any]] | None = None
    diagnostics: dict[str, Any] | None = None
    raw: dict[str, Any] | None = None


class RunResponse(BaseModel):
    run: EngineRun
    output: EngineOutput | None = None


class HealthResponse(BaseModel):
    ok: bool
    runtime: dict[str, Any]
