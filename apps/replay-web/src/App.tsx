import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { proposeSegmentsFromSignals } from "@clubhall/analysis-contracts";
import { summarizeSegmentWithLfmWebGpu } from "@clubhall/engine-lfm-webgpu";
import { createBrowserPoseProvider } from "@clubhall/engine-pose-abstraction";
import { createRfdetrClient } from "@clubhall/engine-rfdetr-client";
import { createClipManifest } from "@clubhall/ffmpeg-tools";
import { ReplayPlayer } from "@clubhall/replay-player";
import { ReplayTimeline, captureVideoThumbnail } from "@clubhall/replay-timeline";
import { listPersistedSessions, readJsonFile, useReplayStore } from "@clubhall/replay-store";
import { Button, Chip, Field, Input, Panel, SectionTitle, Stack, Textarea } from "@clubhall/ui";
import {
  createEngineRun,
  createId,
  findSelectedSegment,
  formatTimecode,
  type ReplaySessionDocument,
  type OverlayLayer
} from "@clubhall/video-domain";
import { ExclusionZoneEditor } from "./components/ExclusionZoneEditor";

const lfmEnabled = import.meta.env.VITE_ENABLE_LFM_WEBGPU === "true";

type ServiceHealthState =
  | { status: "checking" }
  | { status: "ready"; mode: string; detail: string }
  | { status: "fallback"; mode: string; detail: string }
  | { status: "error"; detail: string };

export default function App() {
  const initialize = useReplayStore((state) => state.initialize);
  const status = useReplayStore((state) => state.status);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  if (status === "idle") {
    return null;
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/session/:sessionId" element={<SessionPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function LandingPage() {
  const createSessionFromFile = useReplayStore((state) => state.createSessionFromFile);
  const importSessionExport = useReplayStore((state) => state.importSessionExport);
  const navigate = useNavigate();
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);
  const [sessions, setSessions] = useState<Awaited<ReturnType<typeof listPersistedSessions>>>([]);

  useEffect(() => {
    void listPersistedSessions().then(setSessions);
  }, []);

  return (
    <main className="landing-shell">
      <section className="landing-hero">
        <Chip>ClubHall Replay v0</Chip>
        <h1>Replay operating layer for match memory, segmentation, overlays, and portable analysis.</h1>
        <p>
          Start with one long tennis match. Get a modern timeline, manual and proposed moments, overlay playback, and
          local-first session export without cloud infrastructure.
        </p>
        <div className="landing-actions">
          <Button onClick={() => uploadRef.current?.click()}>Open Match Video</Button>
          <Button variant="secondary" onClick={() => importRef.current?.click()}>
            Import `.clubhall-replay.json`
          </Button>
        </div>
        <input
          ref={uploadRef}
          hidden
          type="file"
          accept="video/*"
          onChange={async (event) => {
            const file = event.currentTarget.files?.[0];
            if (!file) {
              return;
            }
            const document = await createSessionFromFile(file);
            navigate(`/session/${document.session.id}`);
          }}
        />
        <input
          ref={importRef}
          hidden
          type="file"
          accept="application/json,.json"
          onChange={async (event) => {
            const file = event.currentTarget.files?.[0];
            if (!file) {
              return;
            }
            const data = await readJsonFile(file);
            const document = await importSessionExport(data);
            navigate(`/session/${document.session.id}`);
          }}
        />
      </section>

      <section className="landing-grid">
        <Panel className="landing-panel">
          <SectionTitle>Workspace First</SectionTitle>
          <ul className="landing-list">
            <li>Local file ingestion with OPFS persistence when Chromium supports it</li>
            <li>Segment editing, timeline navigation, overlay toggles, and JSON portability</li>
            <li>RF-DETR-compatible analysis lane plus experimental semantic summary lane</li>
          </ul>
        </Panel>

        <Panel className="landing-panel">
          <SectionTitle>Recent Sessions</SectionTitle>
          {sessions.length === 0 ? (
            <p className="landing-empty">No persisted sessions yet.</p>
          ) : (
            <div className="session-list">
              {sessions.map((session) => (
                <Link key={session.id} className="session-card" to={`/session/${session.id}`}>
                  <strong>{session.title}</strong>
                  <span>{session.assetName}</span>
                  <span>{new Date(session.updatedAt).toLocaleString()}</span>
                  {session.requiresRelink ? <Chip>Relink required</Chip> : null}
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </section>
    </main>
  );
}

function SessionPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const document = useReplayStore((state) => state.document);
  const assetUrl = useReplayStore((state) => state.assetUrl);
  const playback = useReplayStore((state) => state.playback);
  const thumbnails = useReplayStore((state) => state.thumbnails);
  const serviceUrl = useReplayStore((state) => state.serviceUrl);
  const loadSession = useReplayStore((state) => state.loadSession);
  const setPlaybackTime = useReplayStore((state) => state.setPlaybackTime);
  const setPlayState = useReplayStore((state) => state.setPlayState);
  const updateAssetMetadata = useReplayStore((state) => state.updateAssetMetadata);
  const addSegment = useReplayStore((state) => state.addSegment);
  const updateSegment = useReplayStore((state) => state.updateSegment);
  const deleteSegment = useReplayStore((state) => state.deleteSegment);
  const selectSegment = useReplayStore((state) => state.selectSegment);
  const setOverlayVisibility = useReplayStore((state) => state.setOverlayVisibility);
  const updateOverlayLayer = useReplayStore((state) => state.updateOverlayLayer);
  const importAnnotationOutput = useReplayStore((state) => state.importAnnotationOutput);
  const exportCurrentSession = useReplayStore((state) => state.exportCurrentSession);
  const relinkAsset = useReplayStore((state) => state.relinkAsset);
  const upsertEngineRun = useReplayStore((state) => state.upsertEngineRun);
  const completeEngineRun = useReplayStore((state) => state.completeEngineRun);
  const setThumbnail = useReplayStore((state) => state.setThumbnail);
  const setServiceUrl = useReplayStore((state) => state.setServiceUrl);
  const appStatus = useReplayStore((state) => state.status);
  const appError = useReplayStore((state) => state.error);

  const [inMarkMs, setInMarkMs] = useState<number | null>(null);
  const [annotationImporting, setAnnotationImporting] = useState(false);
  const [serviceHealth, setServiceHealth] = useState<ServiceHealthState>({ status: "checking" });
  const [zoneEditorEnabled, setZoneEditorEnabled] = useState(false);
  const [draftZonePoints, setDraftZonePoints] = useState<Array<{ x: number; y: number }>>([]);
  const annotationRef = useRef<HTMLInputElement | null>(null);
  const relinkRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (sessionId && document?.session.id !== sessionId) {
      void loadSession(sessionId);
    }
  }, [document?.session.id, loadSession, sessionId]);

  const selectedSegment = useMemo(() => (document ? findSelectedSegment(document) : null), [document]);
  const exclusionLayer = useMemo(
    () => document?.overlayLayers.find((layer) => layer.kind === "exclusion-zones") ?? null,
    [document]
  );
  const exclusionZones = useMemo(() => readZones(exclusionLayer), [exclusionLayer]);
  const selectedTrackPointCount = useMemo(
    () => selectedTracksPointCount(document?.tracks ?? [], selectedSegment),
    [document?.tracks, selectedSegment]
  );

  useEffect(() => {
    let cancelled = false;
    setServiceHealth({ status: "checking" });
    const client = createRfdetrClient(serviceUrl);
    void client
      .getHealth()
      .then((health) => {
        if (cancelled) {
          return;
        }
        setServiceHealth(
          health.runtime.available
            ? {
                status: "ready",
                mode: health.runtime.mode,
                detail: health.runtime.detail ?? health.runtime.label
              }
            : {
                status: "fallback",
                mode: health.runtime.mode,
                detail: health.runtime.detail ?? health.runtime.label
              }
        );
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setServiceHealth({ status: "error", detail: error.message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [serviceUrl]);

  useEffect(() => {
    if (!zoneEditorEnabled) {
      setDraftZonePoints([]);
    }
  }, [zoneEditorEnabled]);

  useEffect(() => {
    if (!document || !assetUrl) {
      return;
    }
    const missingSegments = document.segments.filter((segment) => !thumbnails[segment.id]).slice(0, 4);
    if (missingSegments.length === 0) {
      return;
    }
    void (async () => {
      for (const segment of missingSegments) {
        try {
          const dataUrl = await captureVideoThumbnail(assetUrl, (segment.startMs + segment.endMs) / 2);
          setThumbnail(segment.id, dataUrl);
        } catch {
          break;
        }
      }
    })();
  }, [assetUrl, document, setThumbnail, thumbnails]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!document) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) {
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        setPlayState(!playback.isPlaying);
      }
      if (event.code === "KeyJ") {
        event.preventDefault();
        setPlaybackTime(Math.max(0, playback.currentTimeMs - 5_000));
      }
      if (event.code === "KeyL") {
        event.preventDefault();
        setPlaybackTime(Math.min(document.asset.durationMs ?? playback.currentTimeMs + 5_000, playback.currentTimeMs + 5_000));
      }
      if (event.code === "KeyI") {
        event.preventDefault();
        setInMarkMs(playback.currentTimeMs);
      }
      if (event.code === "KeyO" && inMarkMs !== null) {
        event.preventDefault();
        const startMs = Math.min(inMarkMs, playback.currentTimeMs);
        const endMs = Math.max(inMarkMs, playback.currentTimeMs);
        if (endMs - startMs > 200) {
          void addSegment(startMs, endMs);
        }
      }
      if (event.code === "Backspace" && selectedSegment) {
        event.preventDefault();
        void deleteSegment(selectedSegment.id);
      }
      if (event.code.startsWith("Digit")) {
        const index = Number(event.code.replace("Digit", "")) - 1;
        const layer = document.overlayLayers[index];
        if (layer) {
          event.preventDefault();
          void setOverlayVisibility(layer.id, !layer.visible);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    addSegment,
    deleteSegment,
    document,
    inMarkMs,
    playback.currentTimeMs,
    playback.isPlaying,
    selectedSegment,
    setOverlayVisibility,
    setPlayState,
    setPlaybackTime
  ]);

  if (!sessionId) {
    return <Navigate to="/" replace />;
  }

  if (!document || document.session.id !== sessionId) {
    return (
      <div className="loading-shell">
        <Stack>
          <strong>{appStatus === "error" ? "Session failed to load" : "Loading session…"}</strong>
          {appError ? <p className="muted-copy">{appError}</p> : null}
          <Button variant="ghost" onClick={() => navigate("/")}>
            Back to Library
          </Button>
        </Stack>
      </div>
    );
  }

  const durationMs = document.asset.durationMs ?? 1;
  const clipManifest = createClipManifest(
    document.asset.fingerprint,
    document.segments.map((segment) => ({
      segmentId: segment.id,
      startMs: segment.startMs,
      endMs: segment.endMs,
      label: segment.label
    }))
  );

  const selectedTracks = document.tracks.filter((track) =>
    selectedSegment ? track.points.some((point) => point.timestampMs >= selectedSegment.startMs && point.timestampMs <= selectedSegment.endMs) : true
  );
  const visibleLayers = document.overlayLayers;
  const activeRun = document.engineRuns.at(-1);
  const readyToRun = Boolean(assetUrl) && serviceHealth.status !== "error";
  const serviceDetail = serviceHealth.status === "checking" ? "Checking RF-DETR service…" : serviceHealth.detail;

  return (
    <div className="workspace-shell">
      <header className="workspace-header">
        <div>
          <Link className="workspace-breadcrumb" to="/">
            ClubHall Replay
          </Link>
          <h1>{document.session.title}</h1>
          <p>
            {document.asset.name} • {formatTimecode(durationMs)} • {document.segments.length} segments
          </p>
        </div>
        <div className="workspace-controls">
          <div className="service-control">
            <Input
              aria-label="RF-DETR service URL"
              value={serviceUrl}
              onChange={(event) => setServiceUrl(event.currentTarget.value)}
            />
            <Chip className={`service-chip service-chip--${serviceHealth.status}`}>
              {serviceHealth.status === "checking" ? "Checking service" : serviceHealth.status === "ready" ? "Runtime ready" : serviceHealth.status === "fallback" ? "Fixture fallback" : "Service offline"}
            </Chip>
          </div>
          <Button
            variant="secondary"
            onClick={() =>
              void handleRunRfdetr({
                document,
                assetUrl,
                serviceUrl,
                exclusionZones,
                upsertEngineRun,
                completeEngineRun
              })
            }
            disabled={!readyToRun}
          >
            Run RF-DETR
          </Button>
          <Button variant="secondary" onClick={() => void handleProposals({ document, upsertEngineRun, completeEngineRun })}>
            Propose Segments
          </Button>
          <Button variant="ghost" onClick={() => annotationRef.current?.click()} disabled={annotationImporting}>
            Import Annotations
          </Button>
          <Button
            variant="ghost"
            onClick={async () => {
              const payload = await exportCurrentSession();
              downloadFile(`${document.session.title.replace(/\s+/g, "-").toLowerCase()}.clubhall-replay.json`, payload);
            }}
          >
            Export Session
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              downloadFile(`${document.session.title.replace(/\s+/g, "-").toLowerCase()}.clip-manifest.json`, JSON.stringify(clipManifest, null, 2))
            }
          >
            Export Clips
          </Button>
          {document.asset.storage.relinkRequired ? (
            <Button variant="danger" onClick={() => relinkRef.current?.click()}>
              Relink Video
            </Button>
          ) : null}
          <Button
            variant="ghost"
            onClick={() => void handleRunPose({ document, selectedSegment, upsertEngineRun, completeEngineRun })}
            disabled={!selectedSegment}
          >
            Experimental Pose
          </Button>
          <Button
            variant="ghost"
            onClick={() => void handleRunLfm({ document, selectedSegment, upsertEngineRun, completeEngineRun })}
            disabled={!selectedSegment}
          >
            Experimental Semantic
          </Button>
          <input
            ref={annotationRef}
            hidden
            type="file"
            accept="application/json,.json"
            onChange={async (event) => {
              const file = event.currentTarget.files?.[0];
              if (!file) {
                return;
              }
              setAnnotationImporting(true);
              try {
                const data = await readJsonFile(file);
                await importAnnotationOutput(data);
              } finally {
                setAnnotationImporting(false);
              }
            }}
          />
          <input
            ref={relinkRef}
            hidden
            type="file"
            accept="video/*"
            onChange={async (event) => {
              const file = event.currentTarget.files?.[0];
              if (file) {
                await relinkAsset(file);
              }
            }}
          />
        </div>
      </header>

      <div className="workspace-grid">
        <Panel className="workspace-main">
          <ReplayPlayer
            assetUrl={assetUrl}
            title={selectedSegment?.label ?? document.asset.name}
            currentTimeMs={playback.currentTimeMs}
            isPlaying={playback.isPlaying}
            sourceSize={{
              width: document.asset.width ?? 1920,
              height: document.asset.height ?? 1080
            }}
            tracks={selectedTracks}
            poseFrames={document.poseFrames}
            layers={visibleLayers}
            onTimeUpdate={setPlaybackTime}
            onPlayStateChange={setPlayState}
            onMetadata={updateAssetMetadata}
            overlayContent={
              <ExclusionZoneEditor
                zones={exclusionZones}
                draftPoints={draftZonePoints}
                enabled={zoneEditorEnabled}
                onAddPoint={(point) => setDraftZonePoints((current) => [...current, point])}
                onCancelDraft={() => setDraftZonePoints([])}
                onCloseDraft={() => {
                  if (!exclusionLayer || draftZonePoints.length < 3) {
                    return;
                  }
                  void updateOverlayLayer(exclusionLayer.id, {
                    payload: {
                      ...exclusionLayer.payload,
                      zones: [...exclusionZones, { points: draftZonePoints }]
                    }
                  });
                  setDraftZonePoints([]);
                }}
                onRemoveLastZone={() => {
                  if (!exclusionLayer) {
                    return;
                  }
                  void updateOverlayLayer(exclusionLayer.id, {
                    payload: {
                      ...exclusionLayer.payload,
                      zones: exclusionZones.slice(0, -1)
                    }
                  });
                }}
                onClearZones={() => {
                  if (!exclusionLayer) {
                    return;
                  }
                  void updateOverlayLayer(exclusionLayer.id, {
                    payload: {
                      ...exclusionLayer.payload,
                      zones: []
                    }
                  });
                  setDraftZonePoints([]);
                }}
              />
            }
          />
          <div className="player-status-grid">
            <div className="player-status-card">
              <strong>{selectedTracks.length}</strong>
              <span>visible tracks</span>
            </div>
            <div className="player-status-card">
              <strong>{selectedTrackPointCount}</strong>
              <span>track samples in scope</span>
            </div>
            <div className="player-status-card">
              <strong>{exclusionZones.length}</strong>
              <span>exclusion zones</span>
            </div>
            <div className="player-status-card">
              <strong>{activeRun?.diagnostics?.runtimeMode ?? "pending"}</strong>
              <span>latest runtime mode</span>
            </div>
          </div>
        </Panel>

        <Panel className="workspace-side">
          <Stack>
            <section>
              <SectionTitle>Selected Segment</SectionTitle>
              {selectedSegment ? (
                <Stack className="inspector-block">
                  <div className="segment-summary">
                    <div>
                      <strong>{formatTimecode(selectedSegment.startMs)}</strong>
                      <span>start</span>
                    </div>
                    <div>
                      <strong>{formatTimecode(selectedSegment.endMs)}</strong>
                      <span>end</span>
                    </div>
                    <div>
                      <strong>{formatTimecode(selectedSegment.endMs - selectedSegment.startMs)}</strong>
                      <span>duration</span>
                    </div>
                  </div>
                  <Field label="Label">
                    <Input
                      value={selectedSegment.label}
                      onChange={(event) => void updateSegment(selectedSegment.id, { label: event.currentTarget.value })}
                    />
                  </Field>
                  <Field label="Tags" hint="Comma separated">
                    <Input
                      value={selectedSegment.tags.join(", ")}
                      onChange={(event) =>
                        void updateSegment(selectedSegment.id, {
                          tags: event.currentTarget.value
                            .split(",")
                            .map((value) => value.trim())
                            .filter(Boolean)
                        })
                      }
                    />
                  </Field>
                  <Field label="Notes">
                    <Textarea
                      value={selectedSegment.notes ?? ""}
                      onChange={(event) => void updateSegment(selectedSegment.id, { notes: event.currentTarget.value })}
                    />
                  </Field>
                  <div className="inspector-grid">
                    <Field label="Start (ms)">
                      <Input
                        type="number"
                        value={Math.round(selectedSegment.startMs)}
                        onChange={(event) => void updateSegment(selectedSegment.id, { startMs: Number(event.currentTarget.value) })}
                      />
                    </Field>
                    <Field label="End (ms)">
                      <Input
                        type="number"
                        value={Math.round(selectedSegment.endMs)}
                        onChange={(event) => void updateSegment(selectedSegment.id, { endMs: Number(event.currentTarget.value) })}
                      />
                    </Field>
                  </div>
                  <Button variant="danger" onClick={() => void deleteSegment(selectedSegment.id)}>
                    Delete Segment
                  </Button>
                </Stack>
              ) : (
                <Stack className="inspector-block">
                  <p className="muted-copy">No segment selected. Use `I` and `O` or create a quick segment around the playhead.</p>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      void addSegment(
                        Math.max(0, playback.currentTimeMs - 2_500),
                        Math.min(durationMs, playback.currentTimeMs + 2_500),
                        "Manual moment"
                      )
                    }
                  >
                    Create 5s Segment
                  </Button>
                </Stack>
              )}
            </section>

            <section>
              <SectionTitle>Overlay Layers</SectionTitle>
              <div className="overlay-list">
                {document.overlayLayers.map((layer) => (
                  <label key={layer.id} className="overlay-toggle">
                    <input
                      type="checkbox"
                      checked={layer.visible}
                      onChange={(event) => void setOverlayVisibility(layer.id, event.currentTarget.checked)}
                    />
                    <span>{layer.name}</span>
                    <span className="overlay-hint">{layer.kind}</span>
                  </label>
                ))}
              </div>
              <div className="zone-controls">
                <Button variant={zoneEditorEnabled ? "danger" : "secondary"} onClick={() => setZoneEditorEnabled((current) => !current)}>
                  {zoneEditorEnabled ? "Finish Zone Editing" : "Edit Exclusion Zones"}
                </Button>
                <p className="muted-copy">
                  {exclusionZones.length} zones saved. {draftZonePoints.length} draft points in progress. Service status:{" "}
                  {serviceHealth.status === "ready"
                    ? serviceHealth.mode
                    : serviceHealth.status === "fallback"
                      ? "fixture fallback"
                      : serviceHealth.status === "checking"
                        ? "checking"
                        : "offline"}
                  .
                </p>
              </div>
            </section>

            <section>
              <SectionTitle>Engine Runs</SectionTitle>
              <div className="run-list">
                {document.engineRuns.length === 0 ? (
                  <p className="muted-copy">No analysis runs yet.</p>
                ) : (
                  document.engineRuns
                    .slice()
                    .reverse()
                    .map((run) => (
                      <div key={run.id} className="run-card">
                        <div>
                          <strong>{run.engineId}</strong>
                          <span>{run.engineVersion}</span>
                        </div>
                        <Chip>{run.status}</Chip>
                        {run.diagnostics?.latencyMs ? <span>{Math.round(run.diagnostics.latencyMs)}ms</span> : null}
                        {run.diagnostics?.runtimeMode ? <span>{run.diagnostics.runtimeMode}</span> : null}
                        {run.diagnostics?.detectionCount ? <span>{run.diagnostics.detectionCount} detections</span> : null}
                        {run.diagnostics?.warnings?.length ? <p>{run.diagnostics.warnings[0]}</p> : null}
                      </div>
                    ))
                )}
              </div>
            </section>

            <section>
              <SectionTitle>Insights</SectionTitle>
              <div className="insight-list">
                {document.insights.length === 0 ? (
                  <p className="muted-copy">No insights yet.</p>
                ) : (
                  document.insights
                    .slice()
                    .reverse()
                    .map((insight) => (
                      <div key={insight.id} className="insight-card">
                        <strong>{insight.title}</strong>
                        <p>{insight.body}</p>
                      </div>
                    ))
                )}
              </div>
            </section>
          </Stack>
        </Panel>
      </div>

      <Panel className="workspace-timeline">
        <ReplayTimeline
          durationMs={durationMs}
          currentTimeMs={playback.currentTimeMs}
          segments={document.segments}
          selectedSegmentId={document.session.selectedSegmentId}
          thumbnails={thumbnails}
          onSeek={setPlaybackTime}
          onSelectSegment={(segmentId) => void selectSegment(segmentId)}
        />
      </Panel>

      <section className="segment-row">
        {document.segments.map((segment) => (
          <button key={segment.id} type="button" className="segment-chip" onClick={() => void selectSegment(segment.id)}>
            <strong>{segment.label}</strong>
            <span>
              {formatTimecode(segment.startMs)} - {formatTimecode(segment.endMs)}
            </span>
          </button>
        ))}
      </section>

      <footer className="workspace-footer">
        <span>`Space` play/pause</span>
        <span>`J/L` seek</span>
        <span>`I/O` set segment</span>
        <span>`1-5` toggle layers</span>
        <span>`Backspace` delete selected</span>
        <span>{serviceDetail}</span>
        <Button variant="ghost" onClick={() => navigate("/")}>
          Back to Library
        </Button>
      </footer>
    </div>
  );
}

async function handleRunRfdetr({
  document,
  assetUrl,
  serviceUrl,
  exclusionZones,
  upsertEngineRun,
  completeEngineRun
}: {
  document: ReplaySessionDocument;
  assetUrl: string | null;
  serviceUrl: string;
  exclusionZones: Array<{ points: Array<{ x: number; y: number }> }>;
  upsertEngineRun: (run: ReplaySessionDocument["engineRuns"][number]) => Promise<void>;
  completeEngineRun: (run: ReplaySessionDocument["engineRuns"][number], output: unknown) => Promise<void>;
}) {
  if (!assetUrl) {
    throw new Error("Asset URL unavailable. Relink the source video first.");
  }
  const client = createRfdetrClient(serviceUrl);
  const blob = await fetch(assetUrl).then((response) => response.blob());
  const file = new File([blob], document.asset.name, { type: document.asset.mimeType });
  const registeredAsset = await client.registerAsset(file);
  const runSeed = createEngineRun("rfdetr", "local-v1", {
    assetId: registeredAsset.id,
    sessionId: document.session.id,
    timeRangeMs: findSelectedSegment(document)
      ? [findSelectedSegment(document)!.startMs, findSelectedSegment(document)!.endMs]
      : undefined
  });
  await upsertEngineRun({ ...runSeed, status: "running", updatedAt: new Date().toISOString() });
  const created = await client.createRun({
    asset: registeredAsset,
    sessionId: document.session.id,
    timeRangeMs: findSelectedSegment(document)
      ? [findSelectedSegment(document)!.startMs, findSelectedSegment(document)!.endMs]
      : undefined,
    segmentId: findSelectedSegment(document)?.id,
    mode: "auto",
    exclusionZones
  });
  await upsertEngineRun(created.run);
  const completed = await client.pollRun(created.run.id, (run) => {
    void upsertEngineRun(run);
  });
  if (completed.output) {
    await completeEngineRun(completed.run, completed.output);
  }
}

async function handleRunPose({
  document,
  selectedSegment,
  upsertEngineRun,
  completeEngineRun
}: {
  document: ReplaySessionDocument;
  selectedSegment: ReturnType<typeof findSelectedSegment>;
  upsertEngineRun: (run: ReplaySessionDocument["engineRuns"][number]) => Promise<void>;
  completeEngineRun: (run: ReplaySessionDocument["engineRuns"][number], output: unknown) => Promise<void>;
}) {
  if (!selectedSegment) {
    return;
  }
  const provider = createBrowserPoseProvider();
  const run = createEngineRun("pose-provider", provider.id, {
    assetId: document.asset.id,
    sessionId: document.session.id,
    segmentId: selectedSegment.id,
    timeRangeMs: [selectedSegment.startMs, selectedSegment.endMs]
  });
  await upsertEngineRun({ ...run, status: "running", updatedAt: new Date().toISOString() });
  const result = await provider.analyzeSegment({
    sessionId: document.session.id,
    segment: selectedSegment,
    tracks: document.tracks
  });
  await completeEngineRun(
    {
      ...run,
      status: "completed",
      diagnostics: {
        warnings: result.diagnostics?.warnings ?? []
      },
      updatedAt: new Date().toISOString()
    },
    {
      poseFrames: result.poseFrames,
      insights: result.insights,
      diagnostics: {
        warnings: result.diagnostics?.warnings ?? []
      }
    }
  );
}

async function handleRunLfm({
  document,
  selectedSegment,
  upsertEngineRun,
  completeEngineRun
}: {
  document: ReplaySessionDocument;
  selectedSegment: ReturnType<typeof findSelectedSegment>;
  upsertEngineRun: (run: ReplaySessionDocument["engineRuns"][number]) => Promise<void>;
  completeEngineRun: (run: ReplaySessionDocument["engineRuns"][number], output: unknown) => Promise<void>;
}) {
  if (!selectedSegment) {
    return;
  }
  const run = createEngineRun("lfm-webgpu", "experimental-v1", {
    assetId: document.asset.id,
    sessionId: document.session.id,
    segmentId: selectedSegment.id,
    timeRangeMs: [selectedSegment.startMs, selectedSegment.endMs]
  });
  await upsertEngineRun({ ...run, status: "running", updatedAt: new Date().toISOString() });
  const result = await summarizeSegmentWithLfmWebGpu({
    enabled: lfmEnabled,
    document,
    segment: selectedSegment
  });
  await completeEngineRun(
    {
      ...run,
      status: result.insight ? "completed" : "failed",
      diagnostics: {
        warnings: result.warnings
      },
      updatedAt: new Date().toISOString()
    },
    {
      insights: result.insight ? [result.insight] : [],
      diagnostics: {
        warnings: result.warnings
      }
    }
  );
}

async function handleProposals({
  document,
  upsertEngineRun,
  completeEngineRun
}: {
  document: ReplaySessionDocument;
  upsertEngineRun: (run: ReplaySessionDocument["engineRuns"][number]) => Promise<void>;
  completeEngineRun: (run: ReplaySessionDocument["engineRuns"][number], output: unknown) => Promise<void>;
}) {
  const run = createEngineRun("segment-proposals", "heuristic-v1", {
    assetId: document.asset.id,
    sessionId: document.session.id
  });
  await upsertEngineRun({ ...run, status: "running", updatedAt: new Date().toISOString() });
  const proposals = proposeSegmentsFromSignals({
    sessionId: document.session.id,
    durationMs: document.asset.durationMs ?? 0,
    tracks: document.tracks,
    poseFrames: document.poseFrames,
    exclusionZones: document.overlayLayers.filter((layer) => layer.kind === "exclusion-zones")
  });
  await completeEngineRun(
    {
      ...run,
      status: "completed",
      updatedAt: new Date().toISOString()
    },
    {
      segments: proposals.map((segment) => ({ ...segment, id: createId("segment"), source: "proposal" }))
    }
  );
}

function readZones(layer: OverlayLayer | null) {
  return (((layer?.payload.zones as Array<{ points: Array<{ x: number; y: number }> }> | undefined) ?? []).filter(
    (zone) => zone.points.length >= 3
  ));
}

function selectedTracksPointCount(tracks: ReplaySessionDocument["tracks"], selectedSegment: ReturnType<typeof findSelectedSegment>) {
  if (!selectedSegment) {
    return tracks.reduce((count, track) => count + track.points.length, 0);
  }
  return tracks.reduce(
    (count, track) =>
      count +
      track.points.filter((point) => point.timestampMs >= selectedSegment.startMs && point.timestampMs <= selectedSegment.endMs).length,
    0
  );
}

function downloadFile(filename: string, payload: string) {
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
