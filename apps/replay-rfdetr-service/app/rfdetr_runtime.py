from __future__ import annotations

import json
import os
import shlex
import subprocess
from pathlib import Path
from typing import Any

from .schemas import EngineRequest


def get_runtime_status() -> dict[str, Any]:
    runner = os.getenv("CLUBHALL_RFDETR_RUNNER")
    requested_mode = os.getenv("CLUBHALL_RFDETR_MODE", "auto")
    if runner:
        return {
            "mode": "external-command",
            "requestedMode": requested_mode,
            "available": True,
            "label": "external-command-rfdetr-v1",
            "detail": runner,
        }
    return {
        "mode": "fixture",
        "requestedMode": requested_mode,
        "available": False,
        "label": "fixture-rfdetr-v1",
        "detail": "Set CLUBHALL_RFDETR_RUNNER to enable an external detector command.",
    }


def run_runtime(asset_path: Path, request: EngineRequest) -> tuple[dict[str, Any] | None, list[str], dict[str, Any]]:
    runtime_status = get_runtime_status()
    mode = str(request.options.get("mode", "auto"))
    warnings: list[str] = []

    if mode == "fixture":
        warnings.append("RF-DETR runtime forced to fixture mode by request options.")
        return None, warnings, runtime_status

    if not runtime_status["available"]:
        warnings.append(runtime_status["detail"])
        return None, warnings, runtime_status

    payload = _run_external_command(asset_path, request)
    return payload, warnings, runtime_status


def _run_external_command(asset_path: Path, request: EngineRequest) -> dict[str, Any]:
    runner = os.environ["CLUBHALL_RFDETR_RUNNER"]
    extra_args = shlex.split(os.getenv("CLUBHALL_RFDETR_RUNNER_ARGS", ""))
    command = [runner, *extra_args, "--input", str(asset_path), "--session-id", request.sessionId, "--asset-id", request.assetId]

    if request.segmentId:
        command.extend(["--segment-id", request.segmentId])
    if request.timeRangeMs:
        command.extend(["--start-ms", str(request.timeRangeMs[0]), "--end-ms", str(request.timeRangeMs[1])])

    classes = request.options.get("classes") or ["person", "sports ball"]
    if classes:
        command.extend(["--classes", ",".join(str(class_name) for class_name in classes)])

    process = subprocess.run(
        command,
        capture_output=True,
        text=True,
        check=False,
        timeout=float(os.getenv("CLUBHALL_RFDETR_TIMEOUT_SECONDS", "180")),
    )
    if process.returncode != 0:
        raise RuntimeError(process.stderr.strip() or f"RF-DETR runner exited with {process.returncode}")
    if not process.stdout.strip():
        raise RuntimeError("RF-DETR runner produced no JSON output on stdout.")
    payload = json.loads(process.stdout)
    if not isinstance(payload, dict):
        raise RuntimeError("RF-DETR runner returned invalid payload.")
    return payload
