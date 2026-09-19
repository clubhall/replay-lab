import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ReplayPlayer } from "@clubhall/replay-player";
import { captureVideoThumbnail } from "@clubhall/replay-timeline";
import {
  listPersistedSessions,
  readJsonFile,
  useReplayStore,
} from "@clubhall/replay-store";
import { findSelectedSegment, type Segment } from "@clubhall/video-domain";
import { ArenaChamber } from "./components/ArenaChamber";
import { WatchIcon, type WatchIconName } from "./components/WatchIcon";
import "./watch.css";

const SAMPLE_NAME = "Courtside sample.mp4";
const EMPTY_MOMENTS: Segment[] = [];
const SHOT_TAGS = [
  "Rally",
  "Serve",
  "Forehand",
  "Backhand",
  "Volley",
  "Footwork",
];
function time(ms: number) {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
function errorText(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

function IconButton({
  label,
  icon,
  onClick,
  disabled,
  pressed,
}: {
  label: string;
  icon: WatchIconName;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      className="watch-icon-button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
    >
      <WatchIcon name={icon} />
    </button>
  );
}

export default function WatchPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const store = useReplayStore();
  const sessionDoc =
    sessionId && store.document?.session.id === sessionId
      ? store.document
      : null;
  const assetUrl = sessionDoc ? store.assetUrl : null;
  const duration = sessionDoc?.asset.durationMs ?? 0;
  const currentTime = sessionDoc ? store.playback.currentTimeMs : 0;
  const hasVideo = Boolean(assetUrl && duration > 0);
  const selected = sessionDoc ? findSelectedSegment(sessionDoc) : null;
  const moments = sessionDoc?.segments ?? EMPTY_MOMENTS;
  const isSample =
    sessionDoc?.asset.name === SAMPLE_NAME &&
    sessionDoc.asset.sizeBytes === 685185;
  const [tab, setTab] = useState<"Watch" | "Moments" | "Practice">("Watch");
  const [rate, setRate] = useState(1);
  const [looping, setLooping] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<{
    segment?: Segment;
    at: number;
  } | null>(null);
  const [collection, setCollection] = useState(false);
  const [sessions, setSessions] = useState<
    Awaited<ReturnType<typeof listPersistedSessions>>
  >([]);
  const [removed, setRemoved] = useState<Segment | null>(null);
  const [theatre, setTheatre] = useState(false);
  const upload = useRef<HTMLInputElement>(null);
  const backup = useRef<HTMLInputElement>(null);
  const relink = useRef<HTMLInputElement>(null);
  const cinema = useRef<HTMLDivElement>(null);
  const momentsSection = useRef<HTMLElement>(null);
  const thumbAttempts = useRef(new Set<string>());
  const thumbnailVersions = useRef(new Map<string, string>());
  const loadingId = useRef<string | null>(null);
  const loadSession = store.loadSession;
  const setPlayState = store.setPlayState;
  const setPlaybackTime = store.setPlaybackTime;
  const setThumbnail = store.setThumbnail;
  const updateAssetMetadata = store.updateAssetMetadata;

  useEffect(() => {
    if (
      sessionId &&
      store.document?.session.id !== sessionId &&
      loadingId.current !== sessionId
    ) {
      loadingId.current = sessionId;
      void loadSession(sessionId).catch((err: unknown) =>
        setError(errorText(err)),
      );
    }
  }, [sessionId, store.document?.session.id, loadSession]);

  useEffect(() => {
    void listPersistedSessions()
      .then(setSessions)
      .catch((err: unknown) => setError(errorText(err)));
  }, [sessionId, collection]);

  useEffect(
    () => () => {
      setPlayState(false);
    },
    [setPlayState],
  );
  useEffect(() => {
    setRate(1);
    setLooping(false);
    setNotice("");
    setRemoved(null);
    setError("");
    setEditor(null);
  }, [sessionId]);

  useEffect(() => {
    if (!assetUrl) return;
    const missing = moments
      .map((moment) => ({
        moment,
        key: `${assetUrl}:${moment.id}:${moment.startMs}:${moment.endMs}`,
      }))
      .filter(
        ({ moment, key }) =>
          (!store.thumbnails[moment.id] ||
            thumbnailVersions.current.get(moment.id) !== key) &&
          !thumbAttempts.current.has(key),
      )
      .slice(0, 12);
    for (const { key } of missing) thumbAttempts.current.add(key);
    void (async () => {
      for (const { moment, key } of missing) {
        try {
          const thumbnail = await captureVideoThumbnail(
            assetUrl,
            (moment.startMs + moment.endMs) / 2,
          );
          thumbAttempts.current.delete(key);
          const current = useReplayStore.getState();
          const latestMoment = current.document?.segments.find(
            (candidate) => candidate.id === moment.id,
          );
          if (
            current.assetUrl === assetUrl &&
            latestMoment?.startMs === moment.startMs &&
            latestMoment.endMs === moment.endMs
          ) {
            thumbnailVersions.current.set(moment.id, key);
            setThumbnail(moment.id, thumbnail);
          }
        } catch {
          /* A missing thumbnail must never block a saved moment. */
        }
      }
    })();
  }, [assetUrl, moments, store.thumbnails, setThumbnail]);

  const run = useCallback(async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }, []);

  async function openFile(file: File) {
    if (file.type && !file.type.startsWith("video/"))
      throw new Error("Choose a video recording, such as an MP4 or MOV file.");
    setPlayState(false);
    const created = await store.createSessionFromFile(file);
    setCollection(false);
    setTab("Watch");
    void navigate(`/watch/${created.session.id}`);
  }
  async function openSample() {
    const existing = sessions.find(
      (session) => session.assetName === SAMPLE_NAME,
    );
    if (existing && !existing.requiresRelink) {
      setPlayState(false);
      void navigate(`/watch/${existing.id}`);
      return;
    }
    const response = await fetch("/assets/tennis-demo.mp4");
    if (!response.ok)
      throw new Error(
        "The sample could not be opened. You can choose your own video instead.",
      );
    await openFile(
      new File([await response.blob()], SAMPLE_NAME, { type: "video/mp4" }),
    );
  }
  function seek(ms: number) {
    setPlaybackTime(
      Math.min(duration, Math.max(0, Number.isFinite(ms) ? ms : 0)),
    );
  }
  function play() {
    if (!hasVideo) return;
    if (currentTime >= duration - 100)
      seek(looping && selected ? selected.startMs : 0);
    setPlayState(!store.playback.isPlaying);
  }
  function showMoments() {
    setTab("Moments");
    momentsSection.current?.scrollIntoView({ block: "nearest" });
  }
  function review() {
    if (!hasVideo) return;
    setRate(0.5);
    setLooping(Boolean(selected));
    setTab("Practice");
    if (selected) seek(selected.startMs);
    setPlayState(true);
    setNotice("Half the speed. More time to notice.");
  }
  function openEditor(segment?: Segment) {
    if (!hasVideo) return;
    setPlayState(false);
    setEditor({ segment, at: currentTime });
  }
  async function selectMoment(moment: Segment) {
    await store.selectSegment(moment.id);
    setNotice(`Back to ${moment.label.toLowerCase()}.`);
  }
  const onMetadata = useCallback(
    (metadata: { durationMs: number; width: number; height: number }) => {
      if (!Number.isFinite(metadata.durationMs) || metadata.durationMs <= 0) {
        setError(
          "This video’s duration could not be read. Try another recording.",
        );
        return;
      }
      void updateAssetMetadata(metadata).catch((err: unknown) =>
        setError(errorText(err)),
      );
    },
    [updateAssetMetadata],
  );
  async function exportSession() {
    const json = await store.exportCurrentSession();
    const url = URL.createObjectURL(
      new Blob([json], { type: "application/json" }),
    );
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = `${sessionDoc?.session.title ?? "match"}.clubhall-replay.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Your moments and notes are ready to keep.");
  }
  async function fullscreen() {
    if (window.document.fullscreenElement) {
      await window.document.exitFullscreen();
      return;
    }
    if (cinema.current?.requestFullscreen)
      await cinema.current.requestFullscreen();
    else setTheatre((value) => !value);
  }
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.closest("input, textarea, select, button, a, dialog") ||
        target.isContentEditable ||
        !hasVideo
      )
        return;
      if (event.code === "Space") {
        event.preventDefault();
        setPlayState(!store.playback.isPlaying);
      }
      if (event.code === "ArrowRight") {
        event.preventDefault();
        setPlaybackTime(Math.min(duration, currentTime + 5000));
      }
      if (event.code === "ArrowLeft") {
        event.preventDefault();
        setPlaybackTime(Math.max(0, currentTime - 5000));
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [
    currentTime,
    duration,
    hasVideo,
    store.playback.isPlaying,
    setPlayState,
    setPlaybackTime,
  ]);

  return (
    <div className={`watch-app ${theatre ? "is-theatre" : ""}`}>
      <a className="watch-skip" href="#watch-content">
        Skip to replay
      </a>
      <header className="watch-header">
        <Link
          className="watch-brand"
          to="/"
          onClick={() => setPlayState(false)}
          aria-label="ClubHall Replay home"
        >
          <span>CLUBHall</span>
          <small>REPLAY</small>
        </Link>
        <nav className="watch-nav" aria-label="Replay views">
          {(["Watch", "Moments", "Practice"] as const).map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              aria-current={tab === item ? "page" : undefined}
            >
              {item}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <button
            className="watch-gold-button"
            onClick={() => upload.current?.click()}
            disabled={busy}
          >
            Open match
          </button>
          <IconButton
            label="Your collection"
            icon="folder"
            onClick={() => {
              setPlayState(false);
              setCollection(true);
            }}
          />
        </div>
      </header>
      <input
        ref={upload}
        hidden
        type="file"
        accept="video/*"
        aria-label="Open match video"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void run(() => openFile(file));
        }}
      />
      <input
        ref={relink}
        hidden
        type="file"
        accept="video/*"
        aria-label="Relink original video"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file)
            void run(async () => {
              await store.relinkAsset(file);
              setNotice("Your recording is back. Your moments are here.");
            });
        }}
      />
      <input
        ref={backup}
        hidden
        type="file"
        accept=".json,application/json"
        aria-label="Import replay backup"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file)
            void run(async () => {
              setPlayState(false);
              const imported = await store.importSessionExport(
                await readJsonFile(file),
              );
              setCollection(false);
              void navigate(`/watch/${imported.session.id}`);
            });
        }}
      />
      {busy && (
        <div className="watch-loading" role="status">
          Opening your replay…
        </div>
      )}
      {(error || (sessionId && store.status === "error" && store.error)) && (
        <div className="watch-error" role="alert">
          <span>{error || store.error}</span>
          <button onClick={() => setError("")}>Dismiss</button>
        </div>
      )}
      <main id="watch-content" className="watch-layout">
        <div className="watch-main">
          <div className="watch-title-row">
            <h1>
              {sessionDoc
                ? sessionDoc.session.title.replace(/\.[^.]+$/, "")
                : "Your match, reimagined."}
            </h1>
            <span className="watch-eyebrow">
              {isSample ? "SAMPLE FOOTAGE" : "TENNIS · REPLAY"}
            </span>
          </div>
          <div className="watch-cinema" ref={cinema}>
            {sessionDoc && assetUrl ? (
              <ReplayPlayer
                className="watch-player"
                title={sessionDoc.session.title}
                assetUrl={assetUrl}
                currentTimeMs={currentTime}
                isPlaying={store.playback.isPlaying}
                playbackRate={rate}
                loopRange={
                  looping && selected
                    ? { startMs: selected.startMs, endMs: selected.endMs }
                    : undefined
                }
                showControls={false}
                sourceSize={{
                  width: sessionDoc.asset.width ?? 1920,
                  height: sessionDoc.asset.height ?? 1080,
                }}
                layers={sessionDoc.overlayLayers}
                tracks={sessionDoc.tracks}
                poseFrames={sessionDoc.poseFrames}
                onTimeUpdate={setPlaybackTime}
                onMetadata={onMetadata}
                onPlayStateChange={setPlayState}
                onError={setError}
              />
            ) : (
              <div className="watch-welcome">
                <img
                  src="/assets/court.webp"
                  alt="Concept scene of a tennis court overlooking Rio at sunset"
                />
                <div className="welcome-copy">
                  <h2>
                    {sessionDoc
                      ? "Your moments are here."
                      : "Every match has a story."}
                  </h2>
                  <p>
                    {sessionDoc
                      ? "Reconnect the original video to watch again."
                      : "Bring yours into focus."}
                  </p>
                  <button
                    className="watch-ivory-button"
                    onClick={() =>
                      sessionDoc
                        ? relink.current?.click()
                        : upload.current?.click()
                    }
                    disabled={busy}
                  >
                    {sessionDoc ? "Relink original video" : "Choose a video"}
                  </button>
                  {!sessionDoc && (
                    <button
                      className="sample-button"
                      disabled={busy}
                      onClick={() => void run(openSample)}
                    >
                      Try a sample <WatchIcon name="arrow" size={14} />
                    </button>
                  )}
                </div>
                <span className="concept-label">COURTSIDE · CONCEPT SCENE</span>
              </div>
            )}
            <div className="watch-controls">
              <IconButton
                label={
                  store.playback.isPlaying && sessionDoc ? "Pause" : "Play"
                }
                icon={store.playback.isPlaying && sessionDoc ? "pause" : "play"}
                onClick={play}
                disabled={!hasVideo}
              />
              <IconButton
                label="Back 5 seconds"
                icon="back"
                onClick={() => seek(currentTime - 5000)}
                disabled={!hasVideo}
              />
              <IconButton
                label="Forward 5 seconds"
                icon="forward"
                onClick={() => seek(currentTime + 5000)}
                disabled={!hasVideo}
              />
              <span className="watch-time">
                {time(currentTime)}{" "}
                <span>/ {duration ? time(duration) : "--:--"}</span>
              </span>
              <input
                className="watch-seek"
                type="range"
                aria-label="Playback position"
                aria-valuetext={`${time(currentTime)} of ${time(duration)}`}
                min="0"
                max={duration || 1}
                step="10"
                value={Math.min(currentTime, duration)}
                disabled={!hasVideo}
                onChange={(event) => seek(Number(event.target.value))}
                style={
                  {
                    "--progress": `${duration ? (currentTime / duration) * 100 : 0}%`,
                  } as CSSProperties
                }
              />
              <select
                className="watch-speed"
                aria-label="Playback speed"
                value={rate}
                disabled={!hasVideo}
                onChange={(event) => setRate(Number(event.target.value))}
              >
                <option value={0.25}>0.25×</option>
                <option value={0.5}>0.5×</option>
                <option value={0.75}>0.75×</option>
                <option value={1}>1×</option>
                <option value={1.5}>1.5×</option>
              </select>
              <IconButton
                label="Loop moment"
                icon="loop"
                onClick={() => {
                  setLooping(!looping);
                  if (!looping && selected) seek(selected.startMs);
                }}
                disabled={!hasVideo || !selected}
                pressed={looping}
              />
              <IconButton
                label={theatre ? "Exit theatre" : "Fullscreen"}
                icon="expand"
                onClick={() => void run(fullscreen)}
                disabled={!hasVideo}
              />
            </div>
            {looping && selected && (
              <p className="loop-caption">
                Looping {selected.label} · {time(selected.startMs)}–
                {time(selected.endMs)}
              </p>
            )}
          </div>
          <section
            className="watch-moments"
            ref={momentsSection}
            aria-label={tab === "Practice" ? "Practice" : "Your moments"}
          >
            <div className="moment-heading">
              <h2>
                {tab === "Practice"
                  ? "Take something back to court."
                  : "Your moments"}
              </h2>
              <button
                className="watch-outline-button"
                onClick={() => openEditor()}
                disabled={!hasVideo || busy}
              >
                <WatchIcon name="plus" size={17} />
                Save moment
              </button>
            </div>
            {tab === "Practice" ? (
              <div className="practice-panel">
                <span className="watch-eyebrow">A GUIDED SELF-REVIEW</span>
                <h3>
                  {selected
                    ? selected.label
                    : "One moment. One thing to notice."}
                </h3>
                <p>
                  {selected
                    ? "Watch the moment, then choose one detail you want to repeat or change next time."
                    : "Save a moment from your recording to start your review."}
                </p>
                <div className="practice-steps">
                  <div>
                    <b>01</b>
                    <span>Watch it again</span>
                    <small>See the whole point before slowing it down.</small>
                  </div>
                  <div>
                    <b>02</b>
                    <span>Take a closer look</span>
                    <small>
                      Notice your preparation, contact and recovery.
                    </small>
                  </div>
                  <div>
                    <b>03</b>
                    <span>Keep one takeaway</span>
                    <small>Your own observation for your next match.</small>
                  </div>
                </div>
                <div className="practice-actions">
                  <button
                    className="watch-gold-button"
                    disabled={!hasVideo}
                    onClick={review}
                  >
                    <WatchIcon name="speed" size={18} />
                    Watch at 0.5×
                  </button>
                  <button
                    className="watch-outline-button"
                    disabled={!selected || busy}
                    onClick={() => selected && openEditor(selected)}
                  >
                    Write a takeaway
                  </button>
                  {selected && (
                    <button
                      className="watch-text-button"
                      disabled={busy || selected.tags.includes("reviewed")}
                      onClick={() =>
                        void run(async () => {
                          setPlayState(false);
                          await store.updateSegment(selected.id, {
                            tags: [...new Set([...selected.tags, "reviewed"])],
                          });
                          setNotice(
                            "Moment reviewed. A little more to take back to court.",
                          );
                        })
                      }
                    >
                      {busy
                        ? "Saving review…"
                        : selected.tags.includes("reviewed")
                          ? "Reviewed"
                          : "Mark reviewed"}
                      <WatchIcon name="check" size={16} />
                    </button>
                  )}
                </div>
                {selected?.notes && <blockquote>{selected.notes}</blockquote>}
              </div>
            ) : moments.length ? (
              <>
                <div
                  className={`moment-filmstrip ${tab === "Moments" ? "moment-filmstrip--expanded" : ""}`}
                >
                  {moments.map((moment, index) => (
                    <article
                      key={moment.id}
                      className={`moment-card ${selected?.id === moment.id ? "is-selected" : ""}`}
                    >
                      <button
                        className="moment-select"
                        onClick={() => void run(() => selectMoment(moment))}
                        disabled={busy}
                        aria-label={`Watch ${moment.label}`}
                      >
                        <div className="moment-thumbnail">
                          {store.thumbnails[moment.id] ? (
                            <img src={store.thumbnails[moment.id]} alt="" />
                          ) : (
                            <WatchIcon name="bookmark" size={28} />
                          )}
                          <span>{String(index + 1).padStart(2, "0")}</span>
                          <small>{time(moment.endMs - moment.startMs)}</small>
                        </div>
                        <strong>{moment.label}</strong>
                        <span>
                          {time(moment.startMs)} – {time(moment.endMs)}
                          {moment.tags.includes("reviewed")
                            ? " · Reviewed"
                            : ""}
                        </span>
                      </button>
                      <button
                        className="moment-edit"
                        aria-label={`Edit ${moment.label}`}
                        onClick={() => openEditor(moment)}
                        disabled={!hasVideo}
                      >
                        <WatchIcon name="edit" size={14} />
                      </button>
                    </article>
                  ))}
                </div>
                {selected?.notes && (
                  <p className="moment-note">
                    <WatchIcon name="bookmark" size={15} />
                    {selected.notes}
                  </p>
                )}
              </>
            ) : (
              <div className="moments-empty">
                <button
                  onClick={() => openEditor()}
                  aria-label="Save your first moment"
                  disabled={!hasVideo}
                >
                  <WatchIcon name="plus" size={28} />
                </button>
                <div>
                  <h3>The points you want to come back to.</h3>
                  <p>Save a moment while you watch.</p>
                </div>
              </div>
            )}
            {removed && (
              <div className="undo-bar" role="status">
                Moment removed.
                <button
                  onClick={() =>
                    void run(async () => {
                      const restored = await store.addSegment(
                        removed.startMs,
                        removed.endMs,
                        removed.label,
                      );
                      await store.updateSegment(restored.id, {
                        notes: removed.notes,
                        tags: removed.tags,
                        source: removed.source,
                      });
                      setRemoved(null);
                    })
                  }
                >
                  Undo
                </button>
              </div>
            )}
          </section>
          {sessionDoc && (
            <div className="review-milestones" aria-label="Review milestones">
              <span
                className={moments.length ? "milestone unlocked" : "milestone"}
              >
                <WatchIcon
                  name={moments.length ? "check" : "bookmark"}
                  size={16}
                />
                Moment keeper{moments.length > 0 && <small>Unlocked</small>}
              </span>
              <span
                aria-label={`Closer look: ${moments.some((m) => m.tags.includes("reviewed")) ? "unlocked" : "review a moment to unlock"}`}
                className={
                  moments.some((m) => m.tags.includes("reviewed"))
                    ? "milestone unlocked"
                    : "milestone"
                }
              >
                <WatchIcon name="speed" size={16} />
                Closer look
              </span>
              <span
                aria-label={`One takeaway: ${moments.some((m) => m.notes?.trim()) ? "unlocked" : "write a note to unlock"}`}
                className={
                  moments.some((m) => m.notes?.trim())
                    ? "milestone unlocked"
                    : "milestone"
                }
              >
                <WatchIcon name="edit" size={16} />
                One takeaway
              </span>
            </div>
          )}
          <footer className="watch-footer">
            <span>
              {sessionDoc
                ? "Your video stays on this device."
                : "Your recording. Your pace. Your perspective."}
            </span>
            <div>
              {sessionDoc && (
                <button disabled={busy} onClick={() => void run(exportSession)}>
                  <WatchIcon name="download" size={15} />
                  Export replay
                </button>
              )}
              <Link
                to={sessionDoc ? `/session/${sessionDoc.session.id}` : "/lab"}
                onClick={() => setPlayState(false)}
              >
                Analysis workspace <WatchIcon name="arrow" size={13} />
              </Link>
            </div>
          </footer>
          {isSample && (
            <p className="sample-credit">
              Sample recording ·{" "}
              <a
                href="https://www.pexels.com/video/8224602/"
                target="_blank"
                rel="noreferrer"
              >
                Pexels
              </a>
              . Open match to watch your own game.
            </p>
          )}
        </div>
        <ArenaChamber
          isPlaying={Boolean(sessionDoc && store.playback.isPlaying)}
          isReviewing={rate < 1 || tab === "Practice"}
          hasVideo={hasVideo}
          momentCount={moments.length}
          notice={
            notice ||
            (moments.length
              ? `${moments.length} ${moments.length === 1 ? "moment" : "moments"} worth coming back to.`
              : "")
          }
          onReview={review}
          onMoments={showMoments}
          onPractice={() => setTab("Practice")}
        />
      </main>
      {editor && (
        <MomentEditor
          segment={editor.segment}
          at={editor.at}
          duration={duration}
          onClose={() => setEditor(null)}
          onSave={async (values) => {
            if (editor.segment)
              await store.updateSegment(editor.segment.id, values);
            else {
              const added = await store.addSegment(
                values.startMs,
                values.endMs,
                values.label,
              );
              await store.updateSegment(added.id, {
                notes: values.notes,
                tags: values.tags,
              });
              seek(editor.at);
            }
            setNotice(
              editor.segment
                ? "Your moment, just the way you remember it."
                : "Moment keeper unlocked. This one is yours to replay.",
            );
            setEditor(null);
          }}
          onDelete={
            editor.segment
              ? async () => {
                  const removedMoment = editor.segment!;
                  await store.deleteSegment(removedMoment.id);
                  setRemoved(removedMoment);
                  setEditor(null);
                  setLooping(false);
                }
              : undefined
          }
        />
      )}
      {collection && (
        <Modal
          title="Your collection"
          busy={busy}
          onClose={() => setCollection(false)}
        >
          <p className="modal-intro">
            Your recordings and the moments you kept.
          </p>
          {error && (
            <p className="editor-error" role="alert">
              {error}
            </p>
          )}
          {busy && <p role="status">Opening your replay…</p>}
          <div className="collection-list">
            {sessions.length ? (
              sessions.map((session) => (
                <button
                  key={session.id}
                  disabled={busy}
                  onClick={() => {
                    setPlayState(false);
                    setCollection(false);
                    void navigate(`/watch/${session.id}`);
                  }}
                >
                  <WatchIcon name="play" />
                  <span>
                    <strong>{session.title}</strong>
                    <small>
                      {session.requiresRelink
                        ? "Original video needs relinking"
                        : "Saved on this device"}
                    </small>
                  </span>
                  <WatchIcon name="arrow" size={16} />
                </button>
              ))
            ) : (
              <p>No recordings yet. Bring your first match.</p>
            )}
          </div>
          <div className="modal-actions">
            <button
              className="watch-gold-button"
              disabled={busy}
              onClick={() => upload.current?.click()}
            >
              Open match
            </button>
            <button
              className="watch-outline-button"
              disabled={busy}
              onClick={() => backup.current?.click()}
            >
              Import replay backup
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const requestClose = () => {
    if (!busy) onClose();
  };
  return (
    <dialog
      ref={ref}
      className="watch-dialog"
      aria-label={title}
      aria-busy={busy}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) {
          const rect = ref.current.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            requestClose();
        }
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <IconButton
          label="Close"
          icon="close"
          onClick={requestClose}
          disabled={busy}
        />
      </div>
      {children}
    </dialog>
  );
}
function MomentEditor({
  segment,
  at,
  duration,
  onClose,
  onSave,
  onDelete,
}: {
  segment?: Segment;
  at: number;
  duration: number;
  onClose: () => void;
  onSave: (values: {
    label: string;
    startMs: number;
    endMs: number;
    notes: string;
    tags: string[];
  }) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [label, setLabel] = useState(segment?.label ?? "A moment to remember");
  const [start, setStart] = useState(
    (
      (segment?.startMs ?? Math.max(0, Math.min(at - 8000, duration - 1000))) /
      1000
    ).toFixed(2),
  );
  const [end, setEnd] = useState(
    (
      Math.floor(
        Math.min(duration, segment?.endMs ?? Math.max(at + 4000, 1000)) / 10,
      ) / 100
    ).toFixed(2),
  );
  const [notes, setNotes] = useState(segment?.notes ?? "");
  const [shot, setShot] = useState(
    segment?.tags.find((tag) => SHOT_TAGS.includes(tag)) ?? "Rally",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal
      title={segment ? "Edit moment" : "Save a moment"}
      busy={saving}
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          const startMs = Number(start) * 1000;
          const endMs = Number(end) * 1000;
          if (
            !label.trim() ||
            !Number.isFinite(startMs) ||
            !Number.isFinite(endMs) ||
            startMs < 0 ||
            endMs <= startMs ||
            endMs > duration + 1
          ) {
            setError(
              "Give your moment a name and choose a valid range within the recording.",
            );
            return;
          }
          setSaving(true);
          void onSave({
            label: label.trim(),
            startMs,
            endMs: Math.min(duration, endMs),
            notes: notes.trim(),
            tags: [
              shot,
              ...(segment?.tags.filter((tag) => !SHOT_TAGS.includes(tag)) ??
                []),
            ],
          })
            .catch((err: unknown) => setError(errorText(err)))
            .finally(() => setSaving(false));
        }}
      >
        <p className="modal-intro">
          Keep the play, the feeling, or something to work on.
        </p>
        <label>
          Moment name
          <input
            autoFocus
            value={label}
            maxLength={100}
            onChange={(event) => setLabel(event.target.value)}
            required
          />
        </label>
        <div className="moment-range">
          <label>
            Start (seconds)
            <input
              type="number"
              step="0.01"
              min="0"
              max={duration / 1000}
              value={start}
              onChange={(event) => setStart(event.target.value)}
              required
            />
          </label>
          <label>
            End (seconds)
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={duration / 1000}
              value={end}
              onChange={(event) => setEnd(event.target.value)}
              required
            />
          </label>
        </div>
        <label>
          Shot tag
          <select
            value={shot}
            onChange={(event) => setShot(event.target.value)}
          >
            {SHOT_TAGS.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          What did you notice?
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="One thing to take back to court…"
            maxLength={2000}
            rows={3}
          />
        </label>
        {error && (
          <p role="alert" className="editor-error">
            {error}
          </p>
        )}
        <div className="modal-actions">
          {onDelete && (
            <button
              className="watch-text-button delete-moment"
              type="button"
              disabled={saving}
              onClick={() => {
                setSaving(true);
                void onDelete()
                  .catch((err: unknown) => setError(errorText(err)))
                  .finally(() => setSaving(false));
              }}
            >
              Remove moment
            </button>
          )}
          <button
            type="button"
            className="watch-outline-button"
            disabled={saving}
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="watch-gold-button" type="submit" disabled={saving}>
            {saving ? "Saving…" : segment ? "Save changes" : "Save moment"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
