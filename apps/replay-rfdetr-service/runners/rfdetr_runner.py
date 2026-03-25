from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from time import perf_counter
from typing import Any


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Official ClubHall RF-DETR runner.")
    parser.add_argument("--input", required=True, help="Path to the input video.")
    parser.add_argument("--session-id", required=True)
    parser.add_argument("--asset-id", required=True)
    parser.add_argument("--segment-id")
    parser.add_argument("--start-ms", type=float)
    parser.add_argument("--end-ms", type=float)
    parser.add_argument("--classes", default="person,sports ball")
    return parser.parse_args()


def build_frame_detections(
    predictions: Any,
    allowed_classes: set[str],
    *,
    video_frame: Any | None = None,
) -> list[dict[str, Any]]:
    payload = _coerce_mapping(predictions)
    raw_predictions = payload.get("predictions") or payload.get("detections") or []
    width, height = _resolve_frame_size(payload, video_frame)
    detections: list[dict[str, Any]] = []

    for raw_prediction in raw_predictions:
        prediction = _coerce_mapping(raw_prediction)
        class_name = str(
            prediction.get("class")
            or prediction.get("class_name")
            or prediction.get("className")
            or prediction.get("label")
            or ""
        ).strip()
        if not class_name or (allowed_classes and class_name not in allowed_classes):
            continue

        normalized_box = _normalize_box(prediction, width, height)
        detection: dict[str, Any] = {
            "className": class_name,
            "confidence": _round_number(prediction.get("confidence")),
        }
        if prediction.get("label"):
            detection["label"] = prediction["label"]
        if normalized_box:
            detection["box"] = normalized_box
            detection["centroid"] = _centroid_from_box(normalized_box)
        if prediction.get("tracker_id") is not None:
            detection["trackId"] = str(prediction["tracker_id"])
        elif prediction.get("track_id") is not None:
            detection["trackId"] = str(prediction["track_id"])
        elif prediction.get("detection_id") is not None:
            detection["trackId"] = str(prediction["detection_id"])
        detections.append(detection)

    return detections


def extract_timestamp_ms(video_frame: Any, fallback_index: int) -> float:
    for attr_name in ("frame_timestamp_ms", "timestamp_ms", "frame_timestamp", "timestamp", "time"):
        value = getattr(video_frame, attr_name, None)
        if value is None:
            continue
        if hasattr(value, "total_seconds"):
            return round(float(value.total_seconds()) * 1000, 2)
        if isinstance(value, (int, float)):
            if attr_name.endswith("_ms"):
                return round(float(value), 2)
            return round(float(value) * 1000, 2)

    frame_id = getattr(video_frame, "frame_id", None)
    if frame_id is None:
        frame_id = getattr(video_frame, "frame_number", None)
    fps = getattr(video_frame, "fps", None)
    if fps is None:
        fps = getattr(video_frame, "frame_rate", None)
    if isinstance(frame_id, (int, float)) and isinstance(fps, (int, float)) and fps > 0:
        return round((float(frame_id) / float(fps)) * 1000, 2)

    return round(float(fallback_index) * 1000, 2)


def run(args: argparse.Namespace) -> dict[str, Any]:
    from inference import InferencePipeline

    model_id = os.getenv("CLUBHALL_RFDETR_MODEL_ID", "rfdetr-small")
    api_key = os.getenv("ROBOFLOW_API_KEY")
    allowed_classes = {item.strip() for item in args.classes.split(",") if item.strip()}
    start_ms = args.start_ms if args.start_ms is not None else None
    end_ms = args.end_ms if args.end_ms is not None else None

    frame_index = 0
    frames: list[dict[str, Any]] = []
    started_at = perf_counter()

    def on_prediction(predictions: Any, video_frame: Any) -> None:
        nonlocal frame_index
        timestamp_ms = extract_timestamp_ms(video_frame, frame_index)
        frame_index += 1
        if start_ms is not None and timestamp_ms < start_ms:
            return
        if end_ms is not None and timestamp_ms > end_ms:
            return
        frames.append(
            {
                "timestampMs": timestamp_ms,
                "detections": build_frame_detections(predictions, allowed_classes, video_frame=video_frame),
            }
        )

    pipeline_kwargs: dict[str, Any] = {
        "model_id": model_id,
        "video_reference": str(Path(args.input).resolve()),
        "on_prediction": on_prediction,
    }
    if api_key:
        pipeline_kwargs["api_key"] = api_key

    pipeline = InferencePipeline.init(**pipeline_kwargs)
    pipeline.start()
    pipeline.join()

    latency_ms = round((perf_counter() - started_at) * 1000, 2)
    frames.sort(key=lambda item: item["timestampMs"])
    return {
        "frames": frames,
        "diagnostics": {
            "latencyMs": latency_ms,
            "warnings": [],
        },
        "raw": {
            "assetId": args.asset_id,
            "sessionId": args.session_id,
            "segmentId": args.segment_id,
            "modelId": model_id,
            "inputPath": str(Path(args.input).resolve()),
            "requestedRangeMs": [start_ms, end_ms],
            "classes": sorted(allowed_classes),
            "frameExtraction": "internal",
            "runner": "official-rfdetr-runner-v1",
        },
    }


def _coerce_mapping(value: Any) -> dict[str, Any]:
    if value is None:
        return {}
    if isinstance(value, dict):
        return value
    if isinstance(value, (list, tuple)):
        if len(value) == 1:
            return _coerce_mapping(value[0])
        return {"predictions": [_coerce_mapping(item) for item in value]}
    if hasattr(value, "model_dump"):
        dumped = value.model_dump()
        if isinstance(dumped, dict):
            return dumped
    if hasattr(value, "dict"):
        dumped = value.dict()
        if isinstance(dumped, dict):
            return dumped
    if hasattr(value, "__dict__"):
        dumped = {
            key: item
            for key, item in vars(value).items()
            if not key.startswith("_") and not callable(item)
        }
        if dumped:
            return dumped
    return {}


def _resolve_frame_size(payload: dict[str, Any], video_frame: Any | None) -> tuple[float | None, float | None]:
    image = _coerce_mapping(payload.get("image"))
    width = image.get("width")
    height = image.get("height")
    if isinstance(width, (int, float)) and isinstance(height, (int, float)) and width > 0 and height > 0:
        return float(width), float(height)

    if video_frame is not None:
        frame_image = getattr(video_frame, "image", None)
        shape = getattr(frame_image, "shape", None)
        if isinstance(shape, tuple) and len(shape) >= 2:
            return float(shape[1]), float(shape[0])
        size = getattr(frame_image, "size", None)
        if isinstance(size, tuple) and len(size) >= 2:
            return float(size[0]), float(size[1])

    return None, None


def _normalize_box(prediction: dict[str, Any], width: float | None, height: float | None) -> dict[str, float] | None:
    if all(prediction.get(key) is not None for key in ("x", "y", "width", "height")):
        x_center = float(prediction["x"])
        y_center = float(prediction["y"])
        box_width = float(prediction["width"])
        box_height = float(prediction["height"])
        if width and height and max(abs(x_center), abs(y_center), abs(box_width), abs(box_height)) > 1:
            x = (x_center - box_width / 2) / width
            y = (y_center - box_height / 2) / height
            normalized_width = box_width / width
            normalized_height = box_height / height
        else:
            x = x_center - box_width / 2
            y = y_center - box_height / 2
            normalized_width = box_width
            normalized_height = box_height
        return {
            "x": _clamp(x),
            "y": _clamp(y),
            "width": _clamp(normalized_width),
            "height": _clamp(normalized_height),
        }

    if all(prediction.get(key) is not None for key in ("x1", "y1", "x2", "y2")):
        x1 = float(prediction["x1"])
        y1 = float(prediction["y1"])
        x2 = float(prediction["x2"])
        y2 = float(prediction["y2"])
        if width and height and max(abs(x1), abs(y1), abs(x2), abs(y2)) > 1:
            x = x1 / width
            y = y1 / height
            normalized_width = (x2 - x1) / width
            normalized_height = (y2 - y1) / height
        else:
            x = x1
            y = y1
            normalized_width = x2 - x1
            normalized_height = y2 - y1
        return {
            "x": _clamp(x),
            "y": _clamp(y),
            "width": _clamp(normalized_width),
            "height": _clamp(normalized_height),
        }

    return None


def _centroid_from_box(box: dict[str, float]) -> dict[str, float]:
    return {
        "x": _clamp(box["x"] + box["width"] / 2),
        "y": _clamp(box["y"] + box["height"] / 2),
    }


def _clamp(value: float) -> float:
    return round(max(0.0, min(1.0, value)), 4)


def _round_number(value: Any) -> float | None:
    if isinstance(value, (int, float)):
        return round(float(value), 4)
    return None


def main() -> int:
    args = parse_args()
    payload = run(args)
    print(json.dumps(payload))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
