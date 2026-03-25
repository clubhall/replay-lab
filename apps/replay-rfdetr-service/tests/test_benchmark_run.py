from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_fixture_run_supports_benchmark_clip_metadata() -> None:
    fixture_path = Path(__file__).resolve().parents[3] / "fixtures" / "manifest.json"
    assert fixture_path.exists()

    upload = client.post(
        "/api/v1/assets",
        files={"file": ("fixture.mp4", b"clubhall-fixture-video", "video/mp4")},
    )
    asset = upload.json()

    created = client.post(
        "/api/v1/runs",
        json={
            "version": "v1",
            "engineId": "rfdetr",
            "sessionId": "benchmark_side-baseline-rally",
            "assetId": asset["id"],
            "timeRangeMs": [4000, 12000],
            "options": {
                "mode": "fixture",
                "benchmarkClipId": "side-baseline-rally",
                "classes": ["person", "sports ball"],
            },
        },
    )
    assert created.status_code == 200
