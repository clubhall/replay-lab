from __future__ import annotations

import importlib.util
import json
import os
import subprocess
from pathlib import Path
import sys
from typing import Any

from .schemas import EngineRequest

OFFICIAL_RUNNER_LABEL = "official-rfdetr-runner-v1"
FIXTURE_LABEL = "fixture-rfdetr-v1"


def _runner_script_path() -> Path:
    return Path(__file__).resolve().parents[1] / "runners" / "rfdetr_runner.py"


def _default_model_id() -> str:
    return os.getenv("CLUBHALL_RFDETR_MODEL_ID", "rfdetr-small")


def _runner_available() -> tuple[bool, str]:
    runner_path = _runner_script_path()
    if not runner_path.exists():
        return False, f"Missing committed runner at {runner_path}."
    if importlib.util.find_spec("inference") is None:
        return (
            False,
            "Install runner dependencies with `python3 -m pip install -e apps/replay-rfdetr-service[runner]` to enable the official RF-DETR lane.",
        )
    return True, f"Official runner ready via {_default_model_id()}."


def get_runtime_status() -> dict[str, Any]:
    requested_mode = os.getenv("CLUBHALL_RFDETR_MODE", "auto")
    available, detail = _runner_available()
    if available:
        return {
            "mode": "real-ready",
            "requestedMode": requested_mode,
            "available": True,
            "label": OFFICIAL_RUNNER_LABEL,
            "detail": detail,
            "modelId": _default_model_id(),
        }
    return {
        "mode": "fixture-only",
        "requestedMode": requested_mode,
        "available": False,
        "label": FIXTURE_LABEL,
        "detail": detail,
        "modelId": _default_model_id(),
    }


def run_runtime(asset_path: Path, request: EngineRequest) -> tuple[dict[str, Any] | None, list[str], dict[str, Any], str]:
    runtime_status = get_runtime_status()
    mode = str(request.options.get("mode", "auto"))
    warnings: list[str] = []

    if mode == "fixture":
        warnings.append("RF-DETR runtime forced to fixture mode by request options.")
        return None, warnings, runtime_status, "fixture-forced"

    if not runtime_status["available"]:
        warnings.append(runtime_status["detail"])
        return None, warnings, runtime_status, "fixture-fallback"

    payload = _run_official_runner(asset_path, request)
    return payload, warnings, runtime_status, "real"


def _run_official_runner(asset_path: Path, request: EngineRequest) -> dict[str, Any]:
    command = [
        sys.executable,
        str(_runner_script_path()),
        "--input",
        str(asset_path),
        "--session-id",
        request.sessionId,
        "--asset-id",
        request.assetId,
    ]

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
