import {
  getPoseFrameAtTime,
  getTrackSampleAtTime,
  type OverlayLayer,
  type PoseFrame,
  type Track
} from "@clubhall/video-domain";

type Size = {
  width: number;
  height: number;
};

export type OverlayRenderInput = {
  ctx: CanvasRenderingContext2D;
  canvasSize: Size;
  sourceSize: Size;
  currentTimeMs: number;
  layers: OverlayLayer[];
  tracks: Track[];
  poseFrames: PoseFrame[];
};

type NormalizedPoint = {
  x: number;
  y: number;
};

type Box = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function drawOverlayFrame(input: OverlayRenderInput) {
  const { ctx, canvasSize, sourceSize, currentTimeMs } = input;
  ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

  for (const layer of input.layers.filter((candidate) => candidate.visible)) {
    switch (layer.kind) {
      case "boxes":
        drawBoxes(ctx, input.tracks, currentTimeMs, canvasSize, sourceSize, layer.color ?? "#86efac");
        break;
      case "trails":
        drawTrails(ctx, input.tracks, currentTimeMs, canvasSize, sourceSize, layer.color ?? "#7dd3fc");
        break;
      case "keypoints":
        drawKeypoints(ctx, input.poseFrames, currentTimeMs, canvasSize, sourceSize, layer.color ?? "#fbbf24");
        break;
      case "court-lines":
        drawCourtLines(ctx, layer, canvasSize, sourceSize, layer.color ?? "#f4efe5");
        break;
      case "exclusion-zones":
        drawExclusionZones(ctx, layer, canvasSize, sourceSize, layer.color ?? "#f87171");
        break;
      default:
        break;
    }
  }
}

export function scalePoint(point: NormalizedPoint, canvasSize: Size, sourceSize: Size): NormalizedPoint {
  return {
    x: normalizeCoordinate(point.x, sourceSize.width) * canvasSize.width,
    y: normalizeCoordinate(point.y, sourceSize.height) * canvasSize.height
  };
}

export function scaleBox(box: Box, canvasSize: Size, sourceSize: Size) {
  const x = normalizeCoordinate(box.x, sourceSize.width);
  const y = normalizeCoordinate(box.y, sourceSize.height);
  const width = normalizeDimension(box.width, sourceSize.width);
  const height = normalizeDimension(box.height, sourceSize.height);

  return {
    x: x * canvasSize.width,
    y: y * canvasSize.height,
    width: width * canvasSize.width,
    height: height * canvasSize.height
  };
}

function drawBoxes(
  ctx: CanvasRenderingContext2D,
  tracks: Track[],
  currentTimeMs: number,
  canvasSize: Size,
  sourceSize: Size,
  color: string
) {
  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.font = "12px sans-serif";
  tracks.forEach((track) => {
    const sample = getTrackSampleAtTime(track, currentTimeMs, 120);
    if (!sample?.box) {
      return;
    }
    const box = scaleBox(sample.box, canvasSize, sourceSize);
    ctx.strokeStyle = track.color ?? color;
    ctx.strokeRect(box.x, box.y, box.width, box.height);
    ctx.fillStyle = track.color ?? color;
    ctx.fillText(track.label, box.x, Math.max(14, box.y - 4));
  });
  ctx.restore();
}

function drawTrails(
  ctx: CanvasRenderingContext2D,
  tracks: Track[],
  currentTimeMs: number,
  canvasSize: Size,
  sourceSize: Size,
  color: string
) {
  ctx.save();
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.8;
  tracks.forEach((track) => {
    const trail = track.points.filter(
      (point) => point.centroid && point.timestampMs <= currentTimeMs && point.timestampMs >= currentTimeMs - 2200
    );
    if (trail.length < 2) {
      return;
    }
    ctx.beginPath();
    trail.forEach((point, index) => {
      const scaled = scalePoint(point.centroid!, canvasSize, sourceSize);
      if (index === 0) {
        ctx.moveTo(scaled.x, scaled.y);
      } else {
        ctx.lineTo(scaled.x, scaled.y);
      }
    });
    ctx.strokeStyle = track.color ?? color;
    ctx.stroke();
  });
  ctx.restore();
}

function drawKeypoints(
  ctx: CanvasRenderingContext2D,
  poseFrames: PoseFrame[],
  currentTimeMs: number,
  canvasSize: Size,
  sourceSize: Size,
  color: string
) {
  const frame = getPoseFrameAtTime(poseFrames, currentTimeMs, 180);
  if (!frame) {
    return;
  }

  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  const pointMap = new Map(frame.keypoints.map((keypoint) => [keypoint.name, keypoint]));
  for (const keypoint of frame.keypoints) {
    const point = scalePoint(keypoint, canvasSize, sourceSize);
    ctx.beginPath();
    ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  const connections = [
    ["left_shoulder", "right_shoulder"],
    ["left_shoulder", "left_elbow"],
    ["left_elbow", "left_wrist"],
    ["right_shoulder", "right_elbow"],
    ["right_elbow", "right_wrist"],
    ["left_shoulder", "left_hip"],
    ["right_shoulder", "right_hip"],
    ["left_hip", "right_hip"],
    ["left_hip", "left_knee"],
    ["left_knee", "left_ankle"],
    ["right_hip", "right_knee"],
    ["right_knee", "right_ankle"]
  ] as const;

  for (const [from, to] of connections) {
    const start = pointMap.get(from);
    const end = pointMap.get(to);
    if (!start || !end) {
      continue;
    }
    const scaledStart = scalePoint(start, canvasSize, sourceSize);
    const scaledEnd = scalePoint(end, canvasSize, sourceSize);
    ctx.beginPath();
    ctx.moveTo(scaledStart.x, scaledStart.y);
    ctx.lineTo(scaledEnd.x, scaledEnd.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCourtLines(
  ctx: CanvasRenderingContext2D,
  layer: OverlayLayer,
  canvasSize: Size,
  sourceSize: Size,
  color: string
) {
  const lines = (layer.payload.lines as Array<Array<NormalizedPoint>> | undefined) ?? [];
  if (lines.length === 0) {
    return;
  }
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  for (const line of lines) {
    if (line.length < 2) {
      continue;
    }
    ctx.beginPath();
    line.forEach((point, index) => {
      const scaled = scalePoint(point, canvasSize, sourceSize);
      if (index === 0) {
        ctx.moveTo(scaled.x, scaled.y);
      } else {
        ctx.lineTo(scaled.x, scaled.y);
      }
    });
    ctx.stroke();
  }
  ctx.restore();
}

function drawExclusionZones(
  ctx: CanvasRenderingContext2D,
  layer: OverlayLayer,
  canvasSize: Size,
  sourceSize: Size,
  color: string
) {
  const zones = (layer.payload.zones as Array<{ points: NormalizedPoint[] }> | undefined) ?? [];
  if (zones.length === 0) {
    return;
  }
  ctx.save();
  ctx.fillStyle = `${color}22`;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  for (const zone of zones) {
    if (zone.points.length < 3) {
      continue;
    }
    ctx.beginPath();
    zone.points.forEach((point, index) => {
      const scaled = scalePoint(point, canvasSize, sourceSize);
      if (index === 0) {
        ctx.moveTo(scaled.x, scaled.y);
      } else {
        ctx.lineTo(scaled.x, scaled.y);
      }
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function normalizeCoordinate(value: number, sourceDimension: number) {
  if (value <= 1) {
    return value;
  }
  return value / sourceDimension;
}

function normalizeDimension(value: number, sourceDimension: number) {
  if (value <= 1) {
    return value;
  }
  return value / sourceDimension;
}

