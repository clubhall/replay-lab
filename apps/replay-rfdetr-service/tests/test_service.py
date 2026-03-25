from __future__ import annotations

from fastapi.testclient import TestClient

import app.main as main_module
from app.main import app


client = TestClient(app)


def _register_asset() -> dict:
    upload = client.post(
        "/api/v1/assets",
        files={"file": ("fixture.mp4", b"clubhall-fixture-video", "video/mp4")},
    )
    assert upload.status_code == 200
    return upload.json()


def test_health_reports_runner_readiness() -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert payload["runtime"]["mode"] in {"real-ready", "fixture-only"}


def test_register_asset_and_run_forced_fixture_analysis() -> None:
    asset = _register_asset()

    created = client.post(
        "/api/v1/runs",
        json={
            "version": "v1",
            "engineId": "rfdetr",
            "sessionId": "session_fixture",
            "assetId": asset["id"],
            "options": {
                "mode": "fixture",
                "exclusionZones": [
                    {
                        "points": [
                            {"x": 0.0, "y": 0.0},
                            {"x": 0.2, "y": 0.0},
                            {"x": 0.2, "y": 0.2},
                            {"x": 0.0, "y": 0.2},
                        ]
                    }
                ],
            },
        },
    )
    assert created.status_code == 200
    run = created.json()["run"]

    for _ in range(10):
        fetched = client.get(f"/api/v1/runs/{run['id']}")
        assert fetched.status_code == 200
        payload = fetched.json()
        if payload["run"]["status"] == "completed":
            break

    assert payload["run"]["status"] == "completed"
    assert payload["run"]["diagnostics"]["runtimeMode"] == "fixture-forced"
    assert payload["run"]["engineVersion"] == "fixture-rfdetr-v1"
    assert payload["output"]["tracks"]


def test_real_run_path_completes_without_fixture_fallback(monkeypatch) -> None:
    asset = _register_asset()

    monkeypatch.setattr(
        main_module,
        "get_runtime_status",
        lambda: {
            "mode": "real-ready",
            "requestedMode": "auto",
            "available": True,
            "label": "official-rfdetr-runner-v1",
            "detail": "Official runner ready via rfdetr-small.",
            "modelId": "rfdetr-small",
        },
    )
    monkeypatch.setattr(
        main_module,
        "run_runtime",
        lambda asset_path, request: (
            {
                "frames": [
                    {
                        "timestampMs": 1000,
                        "detections": [
                            {
                                "className": "person",
                                "confidence": 0.96,
                                "box": {"x": 0.4, "y": 0.4, "width": 0.1, "height": 0.2},
                                "centroid": {"x": 0.45, "y": 0.5},
                            }
                        ],
                    }
                ]
            },
            [],
            {
                "mode": "real-ready",
                "requestedMode": "auto",
                "available": True,
                "label": "official-rfdetr-runner-v1",
                "detail": "Official runner ready via rfdetr-small.",
                "modelId": "rfdetr-small",
            },
            "real",
        ),
    )

    created = client.post(
        "/api/v1/runs",
        json={
            "version": "v1",
            "engineId": "rfdetr",
            "sessionId": "session_real",
            "assetId": asset["id"],
            "options": {"mode": "auto"},
        },
    )
    run = created.json()["run"]

    for _ in range(10):
        fetched = client.get(f"/api/v1/runs/{run['id']}")
        payload = fetched.json()
        if payload["run"]["status"] == "completed":
            break

    assert payload["run"]["diagnostics"]["runtimeMode"] == "real"
    assert payload["run"]["engineVersion"] == "official-rfdetr-runner-v1"
    assert payload["output"]["raw"]["runnerReadiness"] == "real-ready"


def test_runner_failure_falls_back_to_fixture(monkeypatch) -> None:
    asset = _register_asset()

    monkeypatch.setattr(
        main_module,
        "get_runtime_status",
        lambda: {
            "mode": "real-ready",
            "requestedMode": "auto",
            "available": True,
            "label": "official-rfdetr-runner-v1",
            "detail": "Official runner ready via rfdetr-small.",
            "modelId": "rfdetr-small",
        },
    )

    def _raise_runtime(asset_path, request):
        raise RuntimeError("boom")

    monkeypatch.setattr(main_module, "run_runtime", _raise_runtime)

    created = client.post(
        "/api/v1/runs",
        json={
            "version": "v1",
            "engineId": "rfdetr",
            "sessionId": "session_fallback",
            "assetId": asset["id"],
            "options": {"mode": "auto"},
        },
    )
    run = created.json()["run"]

    for _ in range(10):
        fetched = client.get(f"/api/v1/runs/{run['id']}")
        payload = fetched.json()
        if payload["run"]["status"] == "completed":
            break

    assert payload["run"]["diagnostics"]["runtimeMode"] == "fixture-fallback"
    assert payload["run"]["engineVersion"] == "fixture-rfdetr-v1"
    assert "Runtime fallback triggered: boom" in payload["run"]["diagnostics"]["warnings"]
