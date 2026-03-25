import type { CSSProperties } from "react";

type Point = {
  x: number;
  y: number;
};

type Zone = {
  points: Point[];
};

type ExclusionZoneEditorProps = {
  zones: Zone[];
  draftPoints: Point[];
  enabled: boolean;
  onAddPoint: (point: Point) => void;
  onCloseDraft: () => void;
  onCancelDraft: () => void;
  onClearZones: () => void;
  onRemoveLastZone: () => void;
};

export function ExclusionZoneEditor({
  zones,
  draftPoints,
  enabled,
  onAddPoint,
  onCloseDraft,
  onCancelDraft,
  onClearZones,
  onRemoveLastZone
}: ExclusionZoneEditorProps) {
  return (
    <div
      aria-hidden={!enabled}
      onClick={(event) => {
        if (!enabled) {
          return;
        }
        const rect = event.currentTarget.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;
        onAddPoint({
          x: clamp(x),
          y: clamp(y)
        });
      }}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: enabled ? "auto" : "none"
      }}
    >
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={svgStyle}>
        {zones.map((zone, index) => (
          <g key={`zone-${index}`}>
            <polygon
              points={zone.points.map((point) => `${point.x * 100},${point.y * 100}`).join(" ")}
              fill="rgba(248, 113, 113, 0.18)"
              stroke="#f87171"
              strokeWidth={0.4}
            />
            {zone.points.map((point, pointIndex) => (
              <circle key={`zone-${index}-${pointIndex}`} cx={point.x * 100} cy={point.y * 100} r={0.6} fill="#ffd4d4" />
            ))}
          </g>
        ))}
        {draftPoints.length > 0 ? (
          <g>
            <polyline
              points={draftPoints.map((point) => `${point.x * 100},${point.y * 100}`).join(" ")}
              fill="none"
              stroke="#facc15"
              strokeWidth={0.45}
              strokeDasharray="1.2 1"
            />
            {draftPoints.map((point, index) => (
              <circle key={`draft-${index}`} cx={point.x * 100} cy={point.y * 100} r={0.7} fill="#facc15" />
            ))}
          </g>
        ) : null}
      </svg>

      {enabled ? (
        <div style={hudStyle} onClick={(event) => event.stopPropagation()}>
          <strong style={{ display: "block", marginBottom: "0.35rem" }}>Exclusion Zone Edit Mode</strong>
          <p style={{ margin: 0, color: "var(--ch-color-ink-muted)", fontSize: "0.78rem" }}>
            Click to add polygon points. Close after 3+ points. Zones are saved into the session immediately.
          </p>
          <div style={actionRowStyle}>
            <button type="button" onClick={onCloseDraft} disabled={draftPoints.length < 3} style={buttonStyle}>
              Close Zone
            </button>
            <button type="button" onClick={onCancelDraft} disabled={draftPoints.length === 0} style={buttonStyle}>
              Cancel Draft
            </button>
            <button type="button" onClick={onRemoveLastZone} disabled={zones.length === 0} style={buttonStyle}>
              Remove Last
            </button>
            <button type="button" onClick={onClearZones} disabled={zones.length === 0} style={buttonStyle}>
              Clear All
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

const svgStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "block"
};

const hudStyle: CSSProperties = {
  position: "absolute",
  top: 16,
  left: 16,
  maxWidth: 320,
  padding: "0.85rem 0.9rem",
  borderRadius: 18,
  border: "1px solid rgba(248, 113, 113, 0.45)",
  background: "rgba(11, 16, 32, 0.9)",
  boxShadow: "0 16px 48px rgba(0, 0, 0, 0.32)"
};

const actionRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.5rem",
  marginTop: "0.85rem"
};

const buttonStyle: CSSProperties = {
  borderRadius: 999,
  border: "1px solid var(--ch-color-border)",
  background: "rgba(244, 239, 229, 0.08)",
  color: "var(--ch-color-ink)",
  padding: "0.52rem 0.72rem",
  cursor: "pointer"
};
