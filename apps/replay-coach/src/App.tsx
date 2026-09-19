import { useEffect, useRef, useState } from "react";
import {
  deriveTennisSession,
  formatPointScore,
  type PointEvent,
} from "@clubhall/coach-game";
import { evaluateCoach } from "@clubhall/coach-knowledge";
import { createClipManifest } from "@clubhall/ffmpeg-tools";
import { createId } from "@clubhall/video-domain";
import {
  acceptDecision,
  localDecision,
  validateAction,
  type Action,
  type DecisionRequest,
} from "./actions";
import {
  download,
  fingerprint,
  listSessions,
  loadMedia,
  saveMedia,
  saveSession,
  reconcileSession,
  type Session,
} from "./session";
import {
  analyzeFrame,
  isEvidenceCurrent,
  visibleLandmark,
  POSE_CONNECTIONS,
  type PoseEvidence,
  type NormalizedRoi,
} from "./pose";
const time = (ms: number) =>
  `${Math.floor(ms / 60000)
    .toString()
    .padStart(2, "0")}:${((ms / 1000) % 60).toFixed(1).padStart(4, "0")}`;
const message = (e: unknown) =>
  e instanceof Error ? e.message : "Não foi possível concluir.";
export function App() {
  const [sessions, setSessions] = useState<Session[]>([]),
    [session, setSession] = useState<Session | null>(null),
    [media, setMedia] = useState<Blob | null>(null),
    [url, setUrl] = useState("");
  const [now, setNow] = useState(0),
    [playing, setPlaying] = useState(false),
    [rate, setRate] = useState(1),
    [loop, setLoop] = useState(false),
    [busy, setBusy] = useState(""),
    [notice, setNotice] = useState(""),
    [saved, setSaved] = useState(""),
    [panel, setPanel] = useState("moment");
  const [intent, setIntent] = useState(""),
    [decisionLabel, setDecisionLabel] = useState("Local · Jev não validado"),
    [roi, setRoi] = useState<NormalizedRoi | null>(null),
    [pose, setPose] = useState<PoseEvidence | null>(null),
    [selecting, setSelecting] = useState(false),
    [coachText, setCoachText] = useState("");
  const [dimensions, setDimensions] = useState({ width: 16, height: 10 }),
    [contacts, setContacts] = useState("");
  const opening = useRef(0);
  const video = useRef<HTMLVideoElement>(null),
    current = useRef(session),
    queue = useRef(Promise.resolve()),
    operation = useRef<AbortController | null>(null),
    decision = useRef<AbortController | null>(null),
    drag = useRef<{ x: number; y: number } | null>(null),
    viewRevision = useRef(0);
  current.current = session;
  useEffect(() => {
    void listSessions()
      .then(setSessions)
      .catch((e) => setNotice(message(e)));
  }, []);
  useEffect(() => {
    if (!media) {
      setUrl("");
      return;
    }
    const next = URL.createObjectURL(media);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [media]);
  useEffect(() => {
    return () => {
      operation.current?.abort();
      decision.current?.abort();
    };
  }, []);
  function invalidate() {
    setSelecting(false);
    drag.current = null;
    viewRevision.current++;
    decision.current?.abort();
    operation.current?.abort();
    setPose(null);
    setRoi(null);
    setCoachText("");
  }
  function update(patch: Partial<Session>) {
    if (!current.current) return;
    invalidate();
    const next = reconcileSession({
      ...current.current,
      ...patch,
      revision: current.current.revision + 1,
    });
    current.current = next;
    setSession(next);
    setSaved("Salvando…");
    queue.current = queue.current
      .then(() => saveSession(next))
      .then(() => {
        setSaved("Sessão salva neste navegador");
        setSessions((old) => [next, ...old.filter((s) => s.id !== next.id)]);
      })
      .catch((e) => {
        setSaved("Não salvo — exporte o projeto");
        setNotice(message(e));
      });
  }
  async function open(raw: Session) {
    if (busy) return;
    const s = reconcileSession(raw);
    setNotice("");
    const token = ++opening.current;
    setContacts("");
    invalidate();
    video.current?.pause();
    setMedia(null);
    setSession(s);
    current.current = s;
    setNow(0);
    setPlaying(false);
    setLoop(false);
    setRate(1);
    const blob = await loadMedia(s.id, s.fingerprint);
    if (opening.current !== token) return;
    setMedia(blob ?? null);
    setSaved("Sessão recuperada");
  }
  async function importVideo(file: File, relink = false) {
    opening.current++;
    operation.current?.abort();
    const controller = new AbortController();
    operation.current = controller;
    setBusy(relink ? "Verificando original…" : "Importando vídeo…");
    setNotice("");
    const temp = URL.createObjectURL(file);
    try {
      const probe = document.createElement("video");
      probe.preload = "metadata";
      probe.src = temp;
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("Formato não decodificado. Tente H.264 MP4.")),
          15000,
        );
        probe.onloadedmetadata = () => {
          clearTimeout(timer);
          resolve();
        };
        probe.onerror = () => {
          clearTimeout(timer);
          reject(new Error("Vídeo não suportado. Tente H.264 MP4."));
        };
      });
      if (!Number.isFinite(probe.duration) || probe.duration <= 0)
        throw new Error("Duração inválida.");
      const hash = await fingerprint(file, controller.signal);
      controller.signal.throwIfAborted();
      if (relink) {
        if (!current.current || current.current.fingerprint !== hash)
          throw new Error("Este arquivo não corresponde ao original.");
        setMedia(file);
        try {
          await saveMedia(current.current.id, file, hash, controller.signal);
          setSaved("Original reconectado");
        } catch (error) {
          setSaved("Original reconectado para esta visita");
          setNotice(
            `O navegador não guardou o vídeo: ${message(error)}. As anotações permanecem salvas; reconecte ao voltar.`,
          );
        }
        return;
      }
      const durationMs = Math.round(probe.duration * 1000);
      setContacts("");
      const s: Session = {
        version: "coach/v1",
        id: createId("coach"),
        revision: 0,
        name: file.name,
        fingerprint: hash,
        size: file.size,
        durationMs,
        demo: false,
        athlete: "",
        hand: "right",
        stroke: "forehand",
        events: [],
        firstServer: "athlete",
        fromMatchStart: false,
        ledger: { entries: [], balance: 0 },
        startMs: 0,
        endMs: Math.min(5000, durationMs),
      };
      try {
        await saveMedia(s.id, file, hash, controller.signal);
      } catch (error) {
        setNotice(
          `O navegador não guardou o vídeo: ${message(error)}. Anotações serão salvas; reconecte o original ao voltar.`,
        );
      }
      controller.signal.throwIfAborted();
      await saveSession(s);
      controller.signal.throwIfAborted();
      invalidate();
      setSession(s);
      current.current = s;
      setMedia(file);
      setSessions((old) => [s, ...old]);
      setNow(0);
      setLoop(false);
      setSaved("Sessão salva neste navegador");
    } catch (e) {
      setNotice(
        controller.signal.aborted ? "Importação cancelada." : message(e),
      );
    } finally {
      URL.revokeObjectURL(temp);
      setBusy("");
      operation.current = null;
    }
  }
  function act(raw: Action) {
    if (!session || !video.current) return;
    const a = validateAction(raw, session.durationMs);
    invalidate();
    const v = video.current;
    if (a.type === "seek") v.currentTime = a.timestampMs / 1000;
    if (a.type === "slow") {
      v.playbackRate = a.rate;
      setRate(a.rate);
    }
    if (a.type === "loop") {
      update({ startMs: a.startMs, endMs: a.endMs });
      setLoop(true);
      v.currentTime = a.startMs / 1000;
    }
    if (a.type === "propose_clip") {
      update({ startMs: a.startMs, endMs: a.endMs });
      setPanel("export");
    }
    if (a.type === "request_better_view") {
      setPanel("coach");
      setCoachText(
        "Preciso de evidência do atleta e do movimento. Pause o vídeo, selecione o corpo e confira o frame. Um frame isolado não prova um erro técnico.",
      );
    }
  }
  function confirmPoint(winner: "athlete" | "opponent") {
    if (session?.demo) {
      setNotice("Demonstrações não concedem pontos reais.");
      return;
    }
    if (!session?.athlete.trim()) {
      setNotice("Identifique seu jogador antes de confirmar o ponto.");
      return;
    }
    if (
      contacts &&
      (!Number.isInteger(Number(contacts)) || Number(contacts) < 1)
    ) {
      setNotice("Informe um número inteiro positivo de contatos.");
      return;
    }
    if (
      session.events.some(
        (e) => e.startMs === session.startMs && e.endMs === session.endMs,
      )
    ) {
      setNotice("Este trecho já tem um ponto. Corrija o momento existente.");
      return;
    }
    const event: PointEvent = {
      id: createId("point"),
      sessionId: session.id,
      revision: 1,
      ordinal: Math.max(0, ...session.events.map((e) => e.ordinal)) + 1,
      state: "confirmed",
      startMs: session.startMs,
      endMs: session.endMs,
      winner,
      source: "manual",
      confirmedBy: session.athlete,
      evidenceIds: [
        `${session.fingerprint}:${session.startMs}-${session.endMs}`,
      ],
      methodVersion: "manual/v1",
      outcome: "unknown",
      ...(contacts ? { rallyContacts: Number(contacts) } : {}),
    };
    update({ events: [...session.events, event] });
    setContacts("");
    setNotice(
      "Ponto confirmado. O placar considera a sequência anotada a partir de 0–0.",
    );
  }
  async function exportClip() {
    if (!session || !media) return;
    const s = session;
    const controller = new AbortController();
    operation.current = controller;
    setBusy("Renderizando MP4 localmente…");
    setNotice("");
    try {
      if (media.size > 1024 ** 3)
        throw new Error("Exportação limitada a 1 GB. Use um arquivo menor.");
      const response = await fetch(
        `/api/coach/export?start=${s.startMs / 1000}&end=${s.endMs / 1000}`,
        { method: "POST", body: media, signal: controller.signal },
      );
      if (!response.ok) {
        const data = (await response.json()) as { error: string };
        throw new Error(data.error);
      }
      const blob = await response.blob();
      download(blob, `replay-${s.startMs}-${s.endMs}.mp4`);
      setNotice("MP4 renderizado com áudio quando presente no original.");
    } catch (e) {
      setNotice(
        controller.signal.aborted ? "Exportação cancelada." : message(e),
      );
    } finally {
      setBusy("");
      operation.current = null;
    }
  }
  async function ask() {
    if (!session || !intent.trim()) return;
    decision.current?.abort();
    const controller = new AbortController();
    decision.current = controller;
    const epoch = viewRevision.current;
    const r: DecisionRequest = {
      requestId: crypto.randomUUID(),
      sessionId: session.id,
      revision: session.revision,
      intent,
      durationMs: session.durationMs,
      startMs: session.startMs,
      endMs: session.endMs,
    };
    const timeout = setTimeout(() => controller.abort(), 2000);
    try {
      let raw: unknown;
      try {
        const response = await fetch("/api/coach/decision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(r),
          signal: controller.signal,
        });
        raw = await response.json();
      } catch {
        raw = localDecision(r, "unavailable");
      }
      if (
        decision.current !== controller ||
        epoch !== viewRevision.current ||
        current.current?.id !== r.sessionId ||
        current.current.revision !== r.revision
      )
        return;
      const d = acceptDecision(raw, r);
      setDecisionLabel(
        `${d.source === "local" ? "Fallback local" : "Jev"} · ${d.reason}`,
      );
      act(d.action);
    } catch (e) {
      setNotice(message(e));
    } finally {
      clearTimeout(timeout);
    }
  }
  async function detect() {
    if (!video.current || !session || !roi) return;
    const controller = new AbortController();
    operation.current = controller;
    setBusy("Analisando este frame…");
    const epoch = viewRevision.current;
    try {
      const result = await analyzeFrame(
        video.current,
        {
          sessionId: session.id,
          assetId: session.fingerprint,
          revision: session.revision,
          playerId: session.athlete,
        },
        roi,
        controller.signal,
      );
      if (
        epoch === viewRevision.current &&
        current.current?.revision === session.revision
      )
        setPose(result);
    } catch (e) {
      setNotice(message(e));
    } finally {
      setBusy("");
      operation.current = null;
    }
  }
  function review() {
    if (!session) return;
    const result = evaluateCoach({
      requestId: crypto.randomUUID(),
      sessionId: session.id,
      assetId: session.fingerprint,
      assetFingerprint: session.fingerprint,
      revision: session.revision,
      durationMs: session.durationMs,
      startMs: session.startMs,
      endMs: session.endMs,
      athlete: {
        id: session.athlete || "unselected",
        playerTrackId: session.athlete || "unselected",
        dominantHand: session.hand,
        backhand: "unknown",
        experience: "unknown",
        goal: "Rever meu movimento",
      },
      stroke: session.stroke,
    });
    setCoachText(
      result.status === "abstained" ? result.message : "Observação disponível.",
    );
  }
  const game = session
    ? deriveTennisSession({
        sessionId: session.id,
        events: session.events,
        firstServer: session.firstServer,
        assetDurationMs: session.durationMs,
      })
    : null;
  const score =
    game && game.complete && session?.fromMatchStart
      ? formatPointScore(game.score)
      : null;
  return (
    <main className="shell">
      <header>
        <a className="brand" href="/">
          C<span>H</span>
          <i />
          CLUBHALL
        </a>
        <span className="eyebrow">REPLAY LAB / COACH 01</span>
        <span className="local-dot">LOCAL</span>
      </header>
      <section className="heading">
        <div>
          <div className="eyebrow gold">SUA PARTIDA. OUTRA PERSPECTIVA.</div>
          <h1>
            O jogo continua<span>.</span>
          </h1>
        </div>
        <label className="button gold-button">
          ＋ Importar vídeo
          <input
            data-testid="import-video"
            type="file"
            accept="video/*"
            disabled={!!busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importVideo(f);
              e.target.value = "";
            }}
          />
        </label>
      </section>
      {notice && (
        <div className="notice" role="status">
          {notice}
          <button aria-label="Fechar aviso" onClick={() => setNotice("")}>
            ×
          </button>
        </div>
      )}
      {busy && (
        <div className="notice" role="status">
          {busy}
          <button onClick={() => operation.current?.abort()}>Cancelar</button>
        </div>
      )}
      <div className="workspace">
        <section className="replay">
          <div
            className="video-stage"
            style={{
              aspectRatio: `${dimensions.width}/${dimensions.height}`,
              maxWidth: `min(100%, ${(70 * dimensions.width) / dimensions.height}vh)`,
              marginInline: "auto",
            }}
          >
            {url ? (
              <>
                <video
                  ref={video}
                  src={url}
                  playsInline
                  preload="metadata"
                  onLoadedMetadata={() => {
                    if (video.current) {
                      video.current.playbackRate = rate;
                      setDimensions({
                        width: video.current.videoWidth,
                        height: video.current.videoHeight,
                      });
                    }
                  }}
                  onTimeUpdate={() => {
                    const v = video.current;
                    if (!v) return;
                    setNow(v.currentTime * 1000);
                    if (
                      loop &&
                      session &&
                      v.currentTime * 1000 >= session.endMs
                    )
                      v.currentTime = session.startMs / 1000;
                  }}
                  onSeeked={() => {
                    invalidate();
                    setNow((video.current?.currentTime ?? 0) * 1000);
                  }}
                  onPlay={() => {
                    invalidate();
                    setPlaying(true);
                  }}
                  onPause={() => setPlaying(false)}
                  onEnded={() => {
                    if (loop && video.current && session) {
                      video.current.currentTime = session.startMs / 1000;
                      void video.current.play();
                    } else setPlaying(false);
                  }}
                  onError={() =>
                    setNotice(
                      "Não foi possível reproduzir este codec. Reconecte um MP4 H.264.",
                    )
                  }
                />
                <svg
                  className={`pose-layer ${selecting ? "selecting" : ""}`}
                  viewBox="0 0 1000 1000"
                  preserveAspectRatio="none"
                  onPointerDown={(e) => {
                    if (!selecting) return;
                    const r = e.currentTarget.getBoundingClientRect();
                    drag.current = {
                      x: (e.clientX - r.left) / r.width,
                      y: (e.clientY - r.top) / r.height,
                    };
                    e.currentTarget.setPointerCapture(e.pointerId);
                  }}
                  onPointerUp={(e) => {
                    const start = drag.current;
                    if (!selecting || !start) return;
                    const r = e.currentTarget.getBoundingClientRect(),
                      x = Math.max(
                        0,
                        Math.min(1, (e.clientX - r.left) / r.width),
                      ),
                      y = Math.max(
                        0,
                        Math.min(1, (e.clientY - r.top) / r.height),
                      );
                    setRoi({
                      x: Math.min(start.x, x),
                      y: Math.min(start.y, y),
                      width: Math.abs(x - start.x),
                      height: Math.abs(y - start.y),
                    });
                    drag.current = null;
                    setSelecting(false);
                  }}
                >
                  {roi && (
                    <rect
                      x={roi.x * 1000}
                      y={roi.y * 1000}
                      width={roi.width * 1000}
                      height={roi.height * 1000}
                      fill="#d7bd7233"
                      stroke="#e7ca80"
                      strokeWidth="2"
                    />
                  )}
                  {pose?.landmarks &&
                    session &&
                    isEvidenceCurrent(
                      pose,
                      {
                        sessionId: session.id,
                        assetId: session.fingerprint,
                        revision: session.revision,
                        playerId: session.athlete,
                      },
                      now / 1000,
                    ) &&
                    POSE_CONNECTIONS.map(([a, b]) => {
                      const l = pose.landmarks?.[a],
                        r = pose.landmarks?.[b];
                      return visibleLandmark(l) && visibleLandmark(r) ? (
                        <line
                          key={`${a}-${b}`}
                          x1={l.x * 1000}
                          y1={l.y * 1000}
                          x2={r.x * 1000}
                          y2={r.y * 1000}
                          stroke="#f2d98f"
                          strokeWidth="3"
                        />
                      ) : null;
                    })}
                </svg>
                <div className="video-top">
                  <span className="glass-tag">
                    {session?.demo ? "DEMONSTRAÇÃO" : "VÍDEO LOCAL"}
                  </span>
                  <span className="glass-tag">
                    {session?.athlete || "Identifique seu jogador"}
                  </span>
                </div>
              </>
            ) : (
              <div className="empty-stage">
                <div className="court">
                  <i />
                  <i />
                  <i />
                </div>
                <span className="eyebrow gold">
                  CADA PONTO TEM MAIS PARA CONTAR
                </span>
                <h2>
                  {session ? "Reconecte seu vídeo." : "Entre na sua partida."}
                </h2>
                <p>
                  {session
                    ? "As anotações estão aqui. Selecione o original para continuar."
                    : "Importe um vídeo para rever, marcar pontos e olhar seu movimento com calma."}
                </p>
                {session ? (
                  <label className="button gold-button">
                    Reconectar original
                    <input
                      type="file"
                      accept="video/*"
                      disabled={!!busy}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void importVideo(f, true);
                        e.target.value = "";
                      }}
                    />
                  </label>
                ) : (
                  <span className="file-hint">
                    MP4, MOV e formatos que seu navegador reproduz
                    <br />
                    Seu vídeo permanece neste computador.
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="transport">
            <button
              aria-label={playing ? "Pausar" : "Reproduzir"}
              disabled={!url || !!busy}
              className="play"
              onClick={() => {
                if (video.current) {
                  if (playing) video.current.pause();
                  else
                    void video.current
                      .play()
                      .catch((e) => setNotice(message(e)));
                }
              }}
            >
              {playing ? "Ⅱ" : "▶"}
            </button>
            <span className="time">
              {time(now)} <em>/ {time(session?.durationMs ?? 0)}</em>
            </span>
            <div className="speed">
              {([0.25, 0.5, 1] as const).map((r) => (
                <button
                  key={r}
                  disabled={!url}
                  className={rate === r ? "selected" : ""}
                  onClick={() => act({ type: "slow", rate: r })}
                >
                  {r}×
                </button>
              ))}
            </div>
            <button
              disabled={!session || !url}
              className={loop ? "selected" : ""}
              onClick={() => {
                if (loop) setLoop(false);
                else if (session)
                  act({
                    type: "loop",
                    startMs: session.startMs,
                    endMs: session.endMs,
                  });
              }}
            >
              ↻ Loop
            </button>
          </div>
          <input
            className="scrubber"
            aria-label="Posição do vídeo"
            type="range"
            min="0"
            max={session?.durationMs ?? 1}
            step="10"
            value={now}
            disabled={!url || !!busy}
            onChange={(e) =>
              act({ type: "seek", timestampMs: Number(e.target.value) })
            }
          />
          <div className="section-title">
            <h2>Momentos da partida</h2>
            <span>{game?.latestEvents.length ?? 0} PONTOS ANOTADOS</span>
          </div>
          <div className="moments">
            {session && game?.latestEvents.length ? (
              game.latestEvents.map((p, i) => (
                <div className="moment" key={p.id}>
                  <button
                    onClick={() => {
                      act({ type: "seek", timestampMs: p.startMs });
                      update({ startMs: p.startMs, endMs: p.endMs });
                    }}
                  >
                    <span className="eyebrow">
                      PONTO {String(i + 1).padStart(2, "0")}
                    </span>
                    <strong>
                      {p.state === "rejected"
                        ? "Resultado pendente"
                        : p.winner === "athlete"
                          ? "Seu ponto"
                          : "Adversário"}
                    </strong>
                    <span>
                      {time(p.startMs)} — {time(p.endMs)}
                    </span>
                  </button>
                  <button
                    className="text-button"
                    onClick={() =>
                      update({
                        events: [
                          ...session.events,
                          {
                            ...p,
                            winner:
                              p.winner === "athlete" ? "opponent" : "athlete",
                            revision: p.revision + 1,
                            source: "manual",
                            confirmedBy:
                              session.athlete.trim() || "local-reviewer",
                            outcome: "unknown",
                            secondServeFault: undefined,
                            serveNumber: undefined,
                            firstServeIn: undefined,
                            state: "confirmed",
                          },
                        ],
                      })
                    }
                  >
                    Corrigir vencedor
                  </button>
                  <label className="moment-edit">
                    Contatos confirmados
                    <input
                      aria-label={`Contatos do ponto ${p.ordinal}`}
                      type="number"
                      min="1"
                      step="1"
                      defaultValue={p.rallyContacts ?? ""}
                      key={`${p.id}-${p.revision}`}
                      onBlur={(e) => {
                        const value = e.target.value;
                        if (
                          value &&
                          (!Number.isInteger(Number(value)) ||
                            Number(value) < 1)
                        ) {
                          setNotice("Contatos devem ser um inteiro positivo.");
                          return;
                        }
                        const count = value ? Number(value) : undefined;
                        if (count !== p.rallyContacts)
                          update({
                            events: [
                              ...session.events,
                              {
                                ...p,
                                rallyContacts: count,
                                revision: p.revision + 1,
                              },
                            ],
                          });
                      }}
                    />
                  </label>
                  <button
                    className="text-button"
                    disabled={p.state === "rejected"}
                    onClick={() =>
                      update({
                        events: [
                          ...session.events,
                          { ...p, state: "rejected", revision: p.revision + 1 },
                        ],
                      })
                    }
                  >
                    Rejeitar ponto
                  </button>
                </div>
              ))
            ) : (
              <p className="muted">
                Marque um trecho e confirme quem ganhou. Seus momentos aparecem
                aqui.
              </p>
            )}
          </div>
        </section>
        <aside>
          <div className="scoreboard">
            <div className="eyebrow">TÊNIS · MELHOR DE 3</div>
            <div className="score-row">
              <span>Você</span>
              <strong>{score ? score.athlete : "—"}</strong>
              <span className="versus">:</span>
              <strong>{score ? score.opponent : "—"}</strong>
              <span>Oponente</span>
            </div>
            <div className="muted">
              {game && game.complete && session?.fromMatchStart
                ? `${game.score.games.athlete}–${game.score.games.opponent} games · ${game.score.sets.length} sets encerrados`
                : "Placar indisponível · trecho parcial"}
            </div>
          </div>
          {game && !game.complete && (
            <p className="notice">
              Sequência incompleta. Corrija os pontos pendentes antes de usar o
              placar.
            </p>
          )}
          <nav className="tabs">
            {[
              ["moment", "Momento"],
              ["coach", "Coach"],
              ["export", "Guardar"],
            ].map(([id, label]) => (
              <button
                key={id}
                className={panel === id ? "active" : ""}
                onClick={() => setPanel(id)}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="detail-panel">
            {!session ? (
              <>
                <span className="eyebrow gold">01 / COMEÇAR</span>
                <h2>Seu vídeo é o ponto de partida.</h2>
                <p className="muted">
                  Playback, pontos confirmados e evidência visual. Uma revisão
                  de cada vez.
                </p>
                <div className="steps">
                  <span>
                    01 <b>Importe a partida</b>
                  </span>
                  <span>
                    02 <b>Encontre seu momento</b>
                  </span>
                  <span>
                    03 <b>Reveja com intenção</b>
                  </span>
                </div>
              </>
            ) : (
              <>
                {panel === "moment" && (
                  <>
                    <span className="eyebrow gold">MARCAR & REVER</span>
                    <h2>Um ponto de cada vez.</h2>
                    <label>
                      Seu jogador
                      <input
                        placeholder="Ex.: Arthur, camiseta branca"
                        value={session.athlete}
                        onChange={(e) => {
                          invalidate();
                          update({ athlete: e.target.value });
                        }}
                      />
                    </label>
                    <label>
                      Primeiro sacador
                      <select
                        value={session.firstServer}
                        disabled={session.events.length > 0}
                        onChange={(e) =>
                          update({
                            firstServer: e.target
                              .value as Session["firstServer"],
                          })
                        }
                      >
                        <option value="athlete">Eu</option>
                        <option value="opponent">Adversário</option>
                      </select>
                    </label>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={session.fromMatchStart}
                        onChange={(e) =>
                          update({ fromMatchStart: e.target.checked })
                        }
                      />{" "}
                      Estou anotando todos os pontos desde 0–0
                    </label>
                    <div className="interval">
                      <label>
                        Início (s)
                        <input
                          type="number"
                          min="0"
                          max={session.endMs / 1000 - 0.01}
                          step="0.1"
                          value={session.startMs / 1000}
                          onChange={(e) => {
                            const value = Number(e.target.value) * 1000;
                            if (value >= 0 && value < session.endMs)
                              update({ startMs: value });
                          }}
                        />
                      </label>
                      <label>
                        Fim (s)
                        <input
                          type="number"
                          min={session.startMs / 1000 + 0.01}
                          max={session.durationMs / 1000}
                          step="0.1"
                          value={session.endMs / 1000}
                          onChange={(e) => {
                            const value = Number(e.target.value) * 1000;
                            if (
                              value > session.startMs &&
                              value <= session.durationMs
                            )
                              update({ endMs: value });
                          }}
                        />
                      </label>
                    </div>
                    <div className="inline-actions">
                      <button
                        disabled={now >= session.endMs}
                        onClick={() => update({ startMs: Math.round(now) })}
                      >
                        A: agora
                      </button>
                      <button
                        disabled={now <= session.startMs}
                        onClick={() => update({ endMs: Math.round(now) })}
                      >
                        B: agora
                      </button>
                    </div>
                    <label>
                      Contatos no rally (se conferidos)
                      <input
                        type="number"
                        min="1"
                        step="1"
                        placeholder="Não anotados"
                        value={contacts}
                        onChange={(e) => setContacts(e.target.value)}
                      />
                    </label>
                    <p className="muted small">
                      Confirme em ordem desde o início da partida. Um trecho
                      parcial não representa o placar completo.
                    </p>
                    <button
                      className="gold-button wide"
                      disabled={
                        !url || !session.athlete || !!busy || session.demo
                      }
                      onClick={() => confirmPoint("athlete")}
                    >
                      ✓ Eu ganhei o ponto
                    </button>
                    <button
                      className="wide"
                      disabled={
                        !url || !session.athlete || !!busy || session.demo
                      }
                      onClick={() => confirmPoint("opponent")}
                    >
                      Ponto do adversário
                    </button>
                    {game && (
                      <div className="stat">
                        <span>Pontos ganhos / observados</span>
                        <strong>
                          {game.statistics.athlete.pointsWon.numerator} /{" "}
                          {game.statistics.athlete.pointsWon.denominator}
                        </strong>
                      </div>
                    )}
                    <div className="stat">
                      <span>XP confirmado nesta sessão</span>
                      <strong>{session.ledger.balance}</strong>
                    </div>
                    {game?.rewards
                      .filter(
                        (r) =>
                          session.fromMatchStart ||
                          r.ruleId !== "under-pressure",
                      )
                      .map((r) => (
                        <p className="badge" key={r.key}>
                          ✦ {r.label} · {r.xp} XP
                        </p>
                      ))}
                  </>
                )}
                {panel === "coach" && (
                  <>
                    <span className="eyebrow gold">
                      EVIDÊNCIA ANTES DA CORREÇÃO
                    </span>
                    <h2>Olhe mais de perto.</h2>
                    <label>
                      Golpe
                      <select
                        value={session.stroke}
                        onChange={(e) => {
                          invalidate();
                          update({
                            stroke: e.target.value as Session["stroke"],
                          });
                        }}
                      >
                        <option value="forehand">Forehand</option>
                        <option value="backhand">Backhand</option>
                        <option value="serve">Saque</option>
                        <option value="return">Retorno</option>
                      </select>
                    </label>
                    <label>
                      Mão dominante
                      <select
                        value={session.hand}
                        onChange={(e) =>
                          update({ hand: e.target.value as Session["hand"] })
                        }
                      >
                        <option value="right">Direita</option>
                        <option value="left">Esquerda</option>
                      </select>
                    </label>
                    <button
                      className="wide"
                      disabled={
                        !url || !session.athlete || !!busy || session.demo
                      }
                      onClick={() => {
                        video.current?.pause();
                        invalidate();
                        setSelecting(true);
                        setNotice(
                          "Arraste um retângulo ao redor do seu corpo no vídeo pausado. Seleção válida apenas para este frame.",
                        );
                      }}
                    >
                      Selecionar corpo neste frame
                    </button>
                    <button
                      className="wide"
                      disabled={!roi || !!busy || playing}
                      onClick={() => {
                        void detect();
                      }}
                    >
                      Detectar pose real
                    </button>
                    {pose && (
                      <p className="muted small">
                        MediaPipe · {pose.status} · {pose.reason} ·{" "}
                        {time(pose.timestampSeconds * 1000)}
                      </p>
                    )}
                    <button className="gold-button wide" onClick={review}>
                      Revisar evidências
                    </button>
                    {coachText && (
                      <div className="coach-note" role="status">
                        {coachText}
                      </div>
                    )}
                    <p className="muted small">
                      A pose deste frame é uma inferência 2D. Sem janela
                      temporal e contato confirmado, o coach se abstém de
                      avaliar sua técnica.
                    </p>
                  </>
                )}
                {panel === "export" && (
                  <>
                    <span className="eyebrow gold">
                      LEVE O MOMENTO COM VOCÊ
                    </span>
                    <h2>Guarde para comparar.</h2>
                    <p>
                      {time(session.startMs)} → {time(session.endMs)}
                    </p>
                    <button
                      className="gold-button wide"
                      disabled={!media || !!busy}
                      onClick={() => {
                        void exportClip();
                      }}
                    >
                      ↓ Exportar corte MP4
                    </button>
                    <p className="muted small">
                      Render local H.264 + AAC. Até 120 s por corte, original de
                      até 1 GB. O vídeo é processado neste computador.
                    </p>
                    <button
                      className="wide"
                      onClick={() =>
                        download(
                          new Blob([JSON.stringify(session, null, 2)], {
                            type: "application/json",
                          }),
                          "replay-coach-session.json",
                        )
                      }
                    >
                      Salvar projeto JSON
                    </button>
                    <button
                      className="wide"
                      onClick={() =>
                        download(
                          new Blob(
                            [
                              JSON.stringify(
                                createClipManifest(session.fingerprint, [
                                  {
                                    segmentId: "selection",
                                    startMs: session.startMs,
                                    endMs: session.endMs,
                                    label: "Coach selection",
                                  },
                                ]),
                                null,
                                2,
                              ),
                            ],
                            { type: "application/json" },
                          ),
                          "replay-coach-composition.json",
                        )
                      }
                    >
                      Salvar composição
                    </button>
                    <p className="muted small">
                      Projeto e composição não incluem vídeo. Mantenha o
                      original para reconectar.
                    </p>
                  </>
                )}
              </>
            )}
          </div>
          {session && (
            <form
              className="director"
              onSubmit={(e) => {
                e.preventDefault();
                void ask();
              }}
            >
              <label htmlFor="intent">DIRETOR DE REPLAY</label>
              <div>
                <input
                  id="intent"
                  placeholder="Ex.: repita este trecho"
                  value={intent}
                  onChange={(e) => setIntent(e.target.value)}
                />
                <button aria-label="Executar pedido" disabled={!url}>
                  ↗
                </button>
              </div>
              <small>{decisionLabel}</small>
            </form>
          )}
        </aside>
      </div>
      <footer>
        <div>
          <span className="eyebrow">SUA COLEÇÃO</span>
          <div className="collection">
            {sessions.map((s) => (
              <button
                disabled={!!busy}
                key={s.id}
                className={session?.id === s.id ? "selected" : ""}
                onClick={() => {
                  void open(s).catch((e) => setNotice(message(e)));
                }}
              >
                {s.name}
              </button>
            ))}
            <label className="text-button">
              Importar projeto
              <input
                type="file"
                accept="application/json"
                disabled={!!busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f && f.size > 20 * 1024 * 1024) {
                    setNotice("Projeto JSON deve ter até 20 MB.");
                    return;
                  }
                  if (f)
                    void f
                      .text()
                      .then(async (text) => {
                        const s = reconcileSession(JSON.parse(text) as unknown);
                        await saveSession(s);
                        setSessions((old) => [
                          s,
                          ...old.filter((x) => x.id !== s.id),
                        ]);
                        await open(s);
                      })
                      .catch((e) => setNotice(message(e)));
                }}
              />
            </label>
          </div>
        </div>
        <span className="muted small" role="status">
          {saved || "Dados locais · sem upload externo"}
        </span>
      </footer>
    </main>
  );
}
