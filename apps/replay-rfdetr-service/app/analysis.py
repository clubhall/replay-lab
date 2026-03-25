from __future__ import annotations

import math
import random
from datetime import datetime, timezone
from typing import Any

from .postprocess import normalize_runtime_payload
from .schemas import EngineOutput, EngineRequest


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def generate_fixture_output(request: EngineRequest, warnings: list[str] | None = None) -> EngineOutput:
    start_ms, end_ms = request.timeRangeMs or (5_000, 15_000)
    duration_ms = max(2_400, end_ms - start_ms)
    steps = max(8, int(duration_ms / 450))
    rng = random.Random(f"{request.assetId}:{start_ms}:{end_ms}")

    player_points = []
    opponent_points = []
    ball_points = []

    for index in range(steps):
        timestamp = start_ms + index * duration_ms / max(1, steps - 1)
        phase = index / max(1, steps - 1)

        player_x = 0.38 + math.sin(phase * math.pi * 1.2) * 0.04
        player_y = 0.72 - phase * 0.06
        opponent_x = 0.62 + math.cos(phase * math.pi * 1.1) * 0.03
        opponent_y = 0.28 + phase * 0.05

        ball_x = 0.42 + phase * 0.18 + math.sin(phase * math.pi * 3.8) * 0.03
        ball_y = 0.58 - math.sin(phase * math.pi) * 0.24 + rng.uniform(-0.012, 0.012)

        player_points.append(
            {
                "timestampMs": timestamp,
                "centroid": {"x": round(player_x, 4), "y": round(player_y, 4)},
                "box": {"x": round(player_x - 0.07, 4), "y": round(player_y - 0.18, 4), "width": 0.15, "height": 0.35},
                "confidence": 0.96,
            }
        )
        opponent_points.append(
            {
                "timestampMs": timestamp,
                "centroid": {"x": round(opponent_x, 4), "y": round(opponent_y, 4)},
                "box": {"x": round(opponent_x - 0.06, 4), "y": round(opponent_y - 0.16, 4), "width": 0.14, "height": 0.33},
                "confidence": 0.95,
            }
        )
        ball_points.append(
            {
                "timestampMs": timestamp,
                "centroid": {"x": round(ball_x, 4), "y": round(ball_y, 4)},
                "confidence": round(0.82 + rng.random() * 0.12, 4),
            }
        )

    payload: dict[str, Any] = {
        "tracks": [
            {
                "id": f"track_player_{request.assetId}",
                "label": "Near player",
                "className": "person",
                "source": "engine",
                "color": "#86efac",
                "points": player_points,
            },
            {
                "id": f"track_opponent_{request.assetId}",
                "label": "Far player",
                "className": "person",
                "source": "engine",
                "color": "#fbbf24",
                "points": opponent_points,
            },
            {
                "id": f"track_ball_{request.assetId}",
                "label": "Ball",
                "className": "sports ball",
                "source": "engine",
                "color": "#7dd3fc",
                "points": ball_points,
            },
        ],
        "insights": [
            {
                "id": f"insight_{request.assetId}",
                "sessionId": request.sessionId,
                "segmentId": request.segmentId,
                "kind": "metric",
                "title": "Fixture analysis summary",
                "body": "Fixture fallback produced player tracks, ball detections, and post-processed trails for replay debugging.",
                "confidence": 0.78,
                "createdAt": now_iso(),
            }
        ],
        "diagnostics": {
            "warnings": warnings or [],
        },
        "raw": {
            "fixtureMode": True,
            "classes": request.options.get("classes", ["person", "sports ball"]),
        },
    }
    return normalize_runtime_payload(request, payload, runtime_mode="fixture")


def normalize_external_output(request: EngineRequest, payload: dict[str, Any], runtime_mode: str) -> EngineOutput:
    return normalize_runtime_payload(request, payload, runtime_mode=runtime_mode)
