from __future__ import annotations

from app.postprocess import normalize_runtime_payload
from app.schemas import EngineRequest
from runners.rfdetr_runner import build_frame_detections


def test_runner_detections_filter_classes_and_normalize_boxes() -> None:
    detections = build_frame_detections(
        {
            "image": {"width": 200, "height": 100},
            "predictions": [
                {"class": "person", "confidence": 0.95, "x": 100, "y": 50, "width": 40, "height": 60},
                {"class": "dog", "confidence": 0.75, "x": 30, "y": 20, "width": 10, "height": 10},
            ],
        },
        {"person"},
    )

    assert detections == [
        {
            "className": "person",
            "confidence": 0.95,
            "box": {"x": 0.4, "y": 0.2, "width": 0.2, "height": 0.6},
            "centroid": {"x": 0.5, "y": 0.5},
        }
    ]


def test_runner_style_frames_preserve_timestamps_through_normalization() -> None:
    request = EngineRequest(
        version="v1",
        engineId="rfdetr",
        sessionId="session_runner",
        assetId="asset_runner",
        options={},
    )
    payload = {
        "frames": [
            {
                "timestampMs": 320.5,
                "detections": [
                    {
                        "className": "person",
                        "confidence": 0.9,
                        "box": {"x": 0.4, "y": 0.2, "width": 0.2, "height": 0.6},
                        "centroid": {"x": 0.5, "y": 0.5},
                    }
                ],
            },
            {
                "timestampMs": 640.5,
                "detections": [
                    {
                        "className": "person",
                        "confidence": 0.88,
                        "box": {"x": 0.42, "y": 0.2, "width": 0.2, "height": 0.6},
                        "centroid": {"x": 0.52, "y": 0.5},
                    }
                ],
            },
        ]
    }

    output = normalize_runtime_payload(request, payload, runtime_mode="real")
    timestamps = [point["timestampMs"] for point in output.tracks[0]["points"]]
    assert timestamps == [320.5, 640.5]
