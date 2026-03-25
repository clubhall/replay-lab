from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


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
            "options": {"fixtureMode": True},
        },
    )
    assert created.status_code == 200
    run = created.json()["run"]

    fetched = client.get(f"/api/v1/runs/{run['id']}")
    assert fetched.status_code == 200
    payload = fetched.json()
    assert payload["run"]["status"] in {"running", "completed"}

