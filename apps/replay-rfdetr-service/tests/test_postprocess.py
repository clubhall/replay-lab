from app.postprocess import normalize_runtime_payload
from app.schemas import EngineRequest


def test_normalize_runtime_payload_builds_tracks_and_filters_exclusion_zones() -> None:
    request = EngineRequest(
        version="v1",
        engineId="rfdetr",
        sessionId="session_fixture",
        assetId="asset_fixture",
        options={
            "exclusionZones": [
                {
                    "points": [
                        {"x": 0.0, "y": 0.0},
                        {"x": 0.3, "y": 0.0},
                        {"x": 0.3, "y": 0.3},
                        {"x": 0.0, "y": 0.3},
                    ]
                }
            ]
        },
    )

    payload = {
        "frames": [
            {
                "timestampMs": 1000,
                "detections": [
                    {
                        "className": "sports ball",
                        "confidence": 0.92,
                        "centroid": {"x": 0.2, "y": 0.2},
                    },
                    {
                        "className": "person",
                        "confidence": 0.97,
                        "box": {"x": 0.4, "y": 0.4, "width": 0.1, "height": 0.2},
                    },
                ],
            },
            {
                "timestampMs": 1600,
                "detections": [
                    {
                        "className": "person",
                        "confidence": 0.95,
                        "box": {"x": 0.42, "y": 0.39, "width": 0.1, "height": 0.2},
                    }
                ],
            },
        ]
    }

    output = normalize_runtime_payload(request, payload, runtime_mode="external-command")
    assert output.diagnostics["exclusionZoneCount"] == 1
    assert len(output.tracks) == 1
    assert output.tracks[0]["className"] == "person"

