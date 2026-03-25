from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health_reports_runtime_mode() -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert payload["runtime"]["mode"] in {"fixture", "external-command"}


def test_register_asset_and_run_fixture_analysis() -> None:
    upload = client.post(
        "/api/v1/assets",
        files={"file": ("fixture.mp4", b"clubhall-fixture-video", "video/mp4")},
    )
    assert upload.status_code == 200
    asset = upload.json()
    assert asset["id"].startswith("asset_")

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
    assert payload["run"]["diagnostics"]["runtimeMode"] == "fixture"
    assert payload["output"]["tracks"]
