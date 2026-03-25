from __future__ import annotations

from app.postprocess import normalize_runtime_payload
from app.schemas import EngineRequest


def test_interpolation_and_smoothing_are_reported_only_when_applied() -> None:
    request = EngineRequest(
        version="v1",
        engineId="rfdetr",
        sessionId="session_interp",
        assetId="asset_interp",
        options={},
    )
    payload = {
        "tracks": [
            {
                "id": "track_ball",
                "className": "sports ball",
                "points": [
                    {"timestampMs": 0, "centroid": {"x": 0.1, "y": 0.2}, "confidence": 0.9},
                    {"timestampMs": 600, "centroid": {"x": 0.2, "y": 0.25}, "confidence": 0.88},
                    {"timestampMs": 900, "centroid": {"x": 0.3, "y": 0.22}, "confidence": 0.86},
                    {"timestampMs": 1200, "centroid": {"x": 0.4, "y": 0.18}, "confidence": 0.87},
                    {"timestampMs": 1500, "centroid": {"x": 0.5, "y": 0.21}, "confidence": 0.89},
                ],
            }
        ]
    }

    output = normalize_runtime_payload(request, payload, runtime_mode="real")
    points = output.tracks[0]["points"]

    assert output.diagnostics["interpolationApplied"] is True
    assert output.diagnostics["smoothingApplied"] is True
    assert any(point.get("interpolated") for point in points)
    assert any(point.get("smoothed") for point in points)


def test_short_ball_tracks_do_not_report_smoothing() -> None:
    request = EngineRequest(
        version="v1",
        engineId="rfdetr",
        sessionId="session_short",
        assetId="asset_short",
        options={},
    )
    payload = {
        "tracks": [
            {
                "id": "track_ball_short",
                "className": "sports ball",
                "points": [
                    {"timestampMs": 0, "centroid": {"x": 0.1, "y": 0.2}},
                    {"timestampMs": 200, "centroid": {"x": 0.2, "y": 0.25}},
                    {"timestampMs": 400, "centroid": {"x": 0.3, "y": 0.22}},
                    {"timestampMs": 600, "centroid": {"x": 0.4, "y": 0.18}},
                ],
            }
        ]
    }

    output = normalize_runtime_payload(request, payload, runtime_mode="real")

    assert output.diagnostics["interpolationApplied"] is False
    assert output.diagnostics["smoothingApplied"] is False
