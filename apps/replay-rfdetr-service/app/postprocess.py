from __future__ import annotations

import math
from collections import defaultdict
from copy import deepcopy
from datetime import datetime, timezone
from statistics import mean
from typing import Any

from .schemas import EngineOutput, EngineRequest

CLASS_COLORS = {
    "person": "#86efac",
    "sports ball": "#7dd3fc",
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_runtime_payload(
    request: EngineRequest,
    payload: dict[str, Any],
    runtime_mode: str,
) -> EngineOutput:
    exclusion_zones = payload.get("exclusionZones") or request.options.get("exclusionZones") or []
    raw_tracks = payload.get("tracks")
    if raw_tracks:
        tracks = _normalize_tracks(request, raw_tracks, exclusion_zones)
        frame_count = max((len(track["points"]) for track in tracks), default=0)
        detection_count = sum(len(track["points"]) for track in tracks)
    else:
        frames = _normalize_frames(payload.get("frames", []), exclusion_zones)
        tracks = _tracks_from_frames(request.sessionId, frames)
        frame_count = len(frames)
        detection_count = sum(len(frame["detections"]) for frame in frames)

    mean_confidence = _calculate_mean_confidence(tracks)
    diagnostics = {
        "warnings": list(payload.get("diagnostics", {}).get("warnings", [])),
        "meanConfidence": round(mean_confidence, 4) if mean_confidence is not None else None,
        "runtimeMode": runtime_mode,
        "frameCount": frame_count,
        "detectionCount": detection_count,
        "smoothingApplied": any(_has_smoothed_samples(track) for track in tracks),
        "interpolationApplied": any(_has_interpolated_samples(track) for track in tracks),
        "exclusionZoneCount": len(exclusion_zones),
    }
    if payload.get("diagnostics", {}).get("latencyMs") is not None:
        diagnostics["latencyMs"] = payload["diagnostics"]["latencyMs"]

    insights = payload.get("insights") or [
        {
            "id": f"insight_{request.assetId}_{runtime_mode}",
            "sessionId": request.sessionId,
            "segmentId": request.segmentId,
            "kind": "diagnostic",
            "title": "RF-DETR analysis lane",
            "body": _build_insight_body(runtime_mode, tracks, len(exclusion_zones)),
            "confidence": 0.74,
            "createdAt": now_iso(),
        }
    ]

    return EngineOutput(
        tracks=tracks,
        insights=insights,
        diagnostics=diagnostics,
        raw={
            **payload.get("raw", {}),
            "actualMode": runtime_mode,
            "runtimeMode": runtime_mode,
            "trackCount": len(tracks),
            "frameCount": frame_count,
            "detectionCount": detection_count,
        },
    )


def _normalize_tracks(
    request: EngineRequest,
    raw_tracks: list[dict[str, Any]],
    exclusion_zones: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    tracks: list[dict[str, Any]] = []
    for index, raw_track in enumerate(raw_tracks):
        points = []
        for point in raw_track.get("points", []):
            centroid = point.get("centroid") or _centroid_from_box(point.get("box"))
            if centroid and _inside_any_zone(centroid, exclusion_zones):
                continue
            normalized_point = {
                "timestampMs": point["timestampMs"],
                "confidence": point.get("confidence"),
            }
            if centroid:
                normalized_point["centroid"] = centroid
            if point.get("box"):
                normalized_point["box"] = point["box"]
            points.append(normalized_point)

        points = _interpolate_track_points(points)
        if raw_track.get("className") == "sports ball":
            points = _smooth_ball_points(points)
        if not points:
            continue

        tracks.append(
            {
                "id": raw_track.get("id") or f"track_{raw_track.get('className', 'object')}_{index}",
                "sessionId": request.sessionId,
                "label": raw_track.get("label") or _default_label(raw_track.get("className", "object")),
                "className": raw_track.get("className", "object"),
                "source": raw_track.get("source", "engine"),
                "color": raw_track.get("color") or CLASS_COLORS.get(raw_track.get("className", "")),
                "points": points,
            }
        )

    return tracks


def _normalize_frames(raw_frames: list[dict[str, Any]], exclusion_zones: list[dict[str, Any]]) -> list[dict[str, Any]]:
    frames = []
    for frame in sorted(raw_frames, key=lambda item: item["timestampMs"]):
        detections = []
        for detection in frame.get("detections", []):
            centroid = detection.get("centroid") or _centroid_from_box(detection.get("box"))
            if centroid and _inside_any_zone(centroid, exclusion_zones):
                continue
            detections.append(
                {
                    "className": detection.get("className", "object"),
                    "label": detection.get("label"),
                    "confidence": detection.get("confidence"),
                    "box": detection.get("box"),
                    "centroid": centroid,
                    "trackId": detection.get("trackId"),
                }
            )
        frames.append({"timestampMs": frame["timestampMs"], "detections": detections})
    return frames


def _tracks_from_frames(session_id: str, frames: list[dict[str, Any]]) -> list[dict[str, Any]]:
    tracks_by_key: dict[str, dict[str, Any]] = {}
    active_tracks_by_class: dict[str, list[str]] = defaultdict(list)
    sequence_by_class: dict[str, int] = defaultdict(int)

    for frame in frames:
        timestamp_ms = frame["timestampMs"]
        for detection in frame.get("detections", []):
            track_key = detection.get("trackId") or _match_track_key(
                detection,
                timestamp_ms,
                active_tracks_by_class[detection["className"]],
                tracks_by_key,
            )
            if not track_key:
                sequence_by_class[detection["className"]] += 1
                track_key = f"{detection['className']}_{sequence_by_class[detection['className']]}"
                tracks_by_key[track_key] = {
                    "id": f"track_{track_key}",
                    "sessionId": session_id,
                    "label": detection.get("label") or _default_label(detection["className"]),
                    "className": detection["className"],
                    "source": "engine",
                    "color": CLASS_COLORS.get(detection["className"]),
                    "points": [],
                }
                active_tracks_by_class[detection["className"]].append(track_key)

            track = tracks_by_key[track_key]
            track["points"].append(
                {
                    "timestampMs": timestamp_ms,
                    "box": detection.get("box"),
                    "centroid": detection.get("centroid"),
                    "confidence": detection.get("confidence"),
                }
            )

    tracks = list(tracks_by_key.values())
    for track in tracks:
        track["points"] = _interpolate_track_points(track["points"])
        if track["className"] == "sports ball":
            track["points"] = _smooth_ball_points(track["points"])
    return [track for track in tracks if track["points"]]


def _match_track_key(
    detection: dict[str, Any],
    timestamp_ms: float,
    candidates: list[str],
    tracks_by_key: dict[str, dict[str, Any]],
) -> str | None:
    centroid = detection.get("centroid")
    if not centroid:
        return None

    best_key = None
    best_distance = math.inf
    for candidate in candidates:
        points = tracks_by_key[candidate]["points"]
        if not points:
            continue
        previous = points[-1]
        previous_centroid = previous.get("centroid")
        if not previous_centroid:
            continue
        if timestamp_ms - previous["timestampMs"] > 1_200:
            continue
        distance = _distance(centroid, previous_centroid)
        threshold = 0.12 if detection["className"] == "sports ball" else 0.2
        if distance <= threshold and distance < best_distance:
            best_distance = distance
            best_key = candidate
    return best_key


def _interpolate_track_points(points: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if len(points) < 2:
        return points

    output: list[dict[str, Any]] = [deepcopy(points[0])]
    for previous, current in zip(points, points[1:]):
        gap = current["timestampMs"] - previous["timestampMs"]
        if 450 < gap <= 1_100 and previous.get("centroid") and current.get("centroid"):
            midpoint = {
                "timestampMs": previous["timestampMs"] + gap / 2,
                "centroid": {
                    "x": round((previous["centroid"]["x"] + current["centroid"]["x"]) / 2, 4),
                    "y": round((previous["centroid"]["y"] + current["centroid"]["y"]) / 2, 4),
                },
                "confidence": _average(previous.get("confidence"), current.get("confidence")),
                "interpolated": True,
            }
            if previous.get("box") and current.get("box"):
                midpoint["box"] = {
                    "x": round((previous["box"]["x"] + current["box"]["x"]) / 2, 4),
                    "y": round((previous["box"]["y"] + current["box"]["y"]) / 2, 4),
                    "width": round((previous["box"]["width"] + current["box"]["width"]) / 2, 4),
                    "height": round((previous["box"]["height"] + current["box"]["height"]) / 2, 4),
                }
            output.append(midpoint)
        output.append(deepcopy(current))
    return output


def _smooth_ball_points(points: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if len(points) < 5:
        return points

    coefficients = (-3 / 35, 12 / 35, 17 / 35, 12 / 35, -3 / 35)
    smoothed = []
    for index, point in enumerate(points):
        window = points[max(0, index - 2) : min(len(points), index + 3)]
        if len(window) < 5 or any(sample.get("centroid") is None for sample in window):
            smoothed.append(point)
            continue
        x = sum(sample["centroid"]["x"] * coefficient for sample, coefficient in zip(window, coefficients))
        y = sum(sample["centroid"]["y"] * coefficient for sample, coefficient in zip(window, coefficients))
        smoothed.append(
            {
                **point,
                "smoothed": True,
                "centroid": {
                    "x": round(x, 4),
                    "y": round(y, 4),
                },
            }
        )
    return smoothed


def _has_interpolated_samples(track: dict[str, Any]) -> bool:
    return any(point.get("interpolated") for point in track.get("points", []))


def _has_smoothed_samples(track: dict[str, Any]) -> bool:
    return any(point.get("smoothed") for point in track.get("points", []))


def _calculate_mean_confidence(tracks: list[dict[str, Any]]) -> float | None:
    confidences = [
        point["confidence"]
        for track in tracks
        for point in track.get("points", [])
        if point.get("confidence") is not None
    ]
    if not confidences:
        return None
    return mean(confidences)


def _build_insight_body(runtime_mode: str, tracks: list[dict[str, Any]], exclusion_zone_count: int) -> str:
    player_tracks = len([track for track in tracks if track["className"] == "person"])
    ball_tracks = len([track for track in tracks if track["className"] == "sports ball"])
    return (
        f"{runtime_mode} lane produced {player_tracks} player tracks and {ball_tracks} ball tracks. "
        f"{exclusion_zone_count} exclusion zones were applied during post-processing."
    )


def _centroid_from_box(box: dict[str, Any] | None) -> dict[str, float] | None:
    if not box:
        return None
    return {
        "x": round(box["x"] + box["width"] / 2, 4),
        "y": round(box["y"] + box["height"] / 2, 4),
    }


def _inside_any_zone(point: dict[str, float], zones: list[dict[str, Any]]) -> bool:
    return any(_point_inside_polygon(point, zone.get("points", [])) for zone in zones)


def _point_inside_polygon(point: dict[str, float], polygon: list[dict[str, float]]) -> bool:
    if len(polygon) < 3:
        return False
    inside = False
    previous = polygon[-1]
    for current in polygon:
        intersects = (current["y"] > point["y"]) != (previous["y"] > point["y"]) and point["x"] < (
            (previous["x"] - current["x"]) * (point["y"] - current["y"]) / ((previous["y"] - current["y"]) + 1e-9)
            + current["x"]
        )
        if intersects:
            inside = not inside
        previous = current
    return inside


def _distance(left: dict[str, float], right: dict[str, float]) -> float:
    return math.sqrt((left["x"] - right["x"]) ** 2 + (left["y"] - right["y"]) ** 2)


def _average(left: float | None, right: float | None) -> float | None:
    values = [value for value in (left, right) if value is not None]
    if not values:
        return None
    return round(sum(values) / len(values), 4)


def _default_label(class_name: str) -> str:
    return "Ball" if class_name == "sports ball" else class_name.replace("-", " ").title()
