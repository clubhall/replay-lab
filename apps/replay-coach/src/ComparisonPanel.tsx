import { useEffect, useRef, useState } from "react";
import { loadMedia, type Session } from "./session";
import {
  ComparisonSchema,
  comparisonWindow,
  comparisonTimes,
  type Comparison,
  type ComparisonWindow,
} from "./comparison";

const KEY = "clubhall-comparison-v1";
const empty = (): Comparison => ({
  version: "comparison/v1",
  left: { sessionId: "", fingerprint: "", referenceMs: 0 },
  right: { sessionId: "", fingerprint: "", referenceMs: 0 },
  positionMs: 0,
});
const seconds = (ms: number) => (ms / 1000).toFixed(2);

export function ComparisonPanel({
  sessions,
  session,
  media,
  pauseMain,
}: {
  sessions: Session[];
  session: Session | null;
  media: Blob | null;
  pauseMain: () => void;
}) {
  const [settings, setSettings] = useState<Comparison>(empty);
  const [urls, setUrls] = useState<string[]>([]);
  const [durations, setDurations] = useState([0, 0]);
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [starting, setStarting] = useState(false);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [reload, setReload] = useState(0);
  const players = useRef<Array<HTMLVideoElement | null>>([null, null]);
  const bindPlayers = useRef(
    [0, 1].map((i) => (node: HTMLVideoElement | null) => {
      if (!node) players.current[i]?.pause();
      players.current[i] = node;
    }),
  );
  const epoch = useRef(0);
  const startup = useRef<AbortController | null>(null);
  const playOwners = useRef(new WeakMap<HTMLVideoElement, number>());
  const current = useRef(settings);
  const running = useRef(false);
  const positionRef = useRef(0);
  const activeWindow = useRef<ComparisonWindow | null>(null);
  const available = useRef({ sessions, session, media });
  available.current = { sessions, session, media };
  current.current = settings;
  let window: ComparisonWindow | null = null;
  let invalid = "";
  if (durations[0] && durations[1]) {
    try {
      window = comparisonWindow(
        durations[0],
        durations[1],
        settings.left.referenceMs,
        settings.right.referenceMs,
      );
    } catch (e) {
      invalid = e instanceof Error ? e.message : "Referências inválidas.";
    }
  }
  activeWindow.current = window;

  function persist(next: Comparison) {
    current.current = next;
    setSettings(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      setNotice(
        "Comparação disponível nesta visita; não foi possível salvar a posição.",
      );
    }
  }
  function pause(save = true) {
    epoch.current++;
    if (startup.current)
      setNotice("Início cancelado. Os dois vídeos estão pausados.");
    startup.current?.abort();
    startup.current = null;
    setStarting(false);
    running.current = false;
    for (const player of players.current) player?.pause();
    // Force a decoded aligned paused frame, including videos previously offscreen.
    if (activeWindow.current) seek(positionRef.current);
    setPlaying(false);
    if (save) persist({ ...current.current, positionMs: positionRef.current });
  }
  function seek(value: number) {
    const scope = activeWindow.current;
    if (!scope) return;
    const times = comparisonTimes(scope, value);
    const [left, right] = players.current;
    if (left) left.currentTime = times.leftMs / 1000;
    if (right) right.currentTime = times.rightMs / 1000;
    positionRef.current = times.positionMs;
    setPosition(times.positionMs);
  }
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) {
        const restored = ComparisonSchema.parse(JSON.parse(saved));
        current.current = restored;
        setSettings(restored);
        positionRef.current = restored.positionMs;
        setPosition(restored.positionMs);
      }
    } catch {
      setNotice("Comparação salva inválida; selecione os originais novamente.");
    }
  }, []);
  useEffect(() => {
    let disposed = false;
    const playbackEpoch = epoch;
    const playbackPlayers = players.current;
    const created: string[] = [];
    epoch.current++;
    startup.current?.abort();
    setStarting(false);
    running.current = false;
    for (const player of players.current) player?.pause();
    setPlaying(false);
    setUrls([]);
    setDurations([0, 0]);
    const pair = [current.current.left, current.current.right];
    if (!pair.every((source) => source.sessionId)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotice("Verificando os dois originais locais…");
    void (async () => {
      for (const source of pair) {
        const state = available.current;
        const original = state.sessions.find(
          (s) =>
            s.id === source.sessionId && s.fingerprint === source.fingerprint,
        );
        if (!original)
          throw new Error(
            "Sessão ou original indisponível. Selecione novamente os dois vídeos.",
          );
        const blob =
          state.session?.fingerprint === original.fingerprint && state.media
            ? state.media
            : await loadMedia(original.id, original.fingerprint);
        if (disposed) return;
        if (!blob)
          throw new Error(
            `Reconecte o original na coleção: ${original.name}. A comparação exige os dois vídeos.`,
          );
        created.push(URL.createObjectURL(blob));
      }
      if (!disposed) {
        setUrls([...created]);
        setNotice("");
      }
    })()
      .catch((e) => {
        for (const url of created.splice(0)) URL.revokeObjectURL(url);
        if (!disposed)
          setNotice(
            e instanceof Error
              ? e.message
              : "Não foi possível abrir a comparação.",
          );
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
      playbackEpoch.current++;
      startup.current?.abort();
      running.current = false;
      for (const player of playbackPlayers) player?.pause();
      for (const url of created) URL.revokeObjectURL(url);
    };
  }, [
    settings.left.sessionId,
    settings.left.fingerprint,
    settings.right.sessionId,
    settings.right.fingerprint,
    reload,
    sessions.length,
  ]);
  const leftDuration = durations[0],
    rightDuration = durations[1];
  useEffect(() => {
    if (!window) return;
    seek(current.current.positionMs);
    // References and decoded durations define a new shared viewing window.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    leftDuration,
    rightDuration,
    settings.left.referenceMs,
    settings.right.referenceMs,
  ]);
  useEffect(() => {
    const playbackEpoch = epoch;
    const playbackPlayers = players.current;
    const hidden = () => {
      if (document.hidden) pause();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      playbackEpoch.current++;
      startup.current?.abort();
      for (const player of playbackPlayers) player?.pause();
    };
    // Playback refs preserve the current pair without reattaching on every frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      const [left, right] = players.current;
      const scope = activeWindow.current;
      if (!running.current || !left || !right || !scope) return;
      const next = comparisonTimes(
        scope,
        left.currentTime * 1000 - scope.leftStartMs,
      );
      positionRef.current = next.positionMs;
      setPosition(next.positionMs);
      if (
        next.positionMs >= scope.durationMs - 20 ||
        left.ended ||
        right.ended
      ) {
        seek(scope.durationMs);
        pause();
        return;
      }
      if (Math.abs(right.currentTime * 1000 - next.rightMs) > 80)
        right.currentTime = next.rightMs / 1000;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // Animation reads current source/timing refs; frame updates must not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);
  async function play() {
    if (!activeWindow.current || urls.length !== 2) return;
    pauseMain();
    startup.current?.abort();
    const controller = new AbortController();
    startup.current = controller;
    const token = ++epoch.current;
    setStarting(true);
    setNotice("Preparando os dois vídeos…");
    seek(
      positionRef.current >= activeWindow.current.durationMs - 20
        ? 0
        : positionRef.current,
    );
    const signal = AbortSignal.any([
      controller.signal,
      AbortSignal.timeout(2000),
    ]);
    let removeAbort = () => {};
    try {
      const deadline = new Promise<never>((_, reject) => {
        const abort = () =>
          reject(
            new Error("Tempo de preparação excedido ou início cancelado."),
          );
        signal.addEventListener("abort", abort, { once: true });
        removeAbort = () => signal.removeEventListener("abort", abort);
      });
      const attempts = players.current.map((player) => {
        if (!player) return Promise.reject(new Error("Original indisponível"));
        playOwners.current.set(player, token);
        return player.play().then(() => {
          if (
            token !== epoch.current &&
            playOwners.current.get(player) !== epoch.current
          )
            player.pause();
        });
      });
      await Promise.race([Promise.all(attempts), deadline]);
      if (token !== epoch.current) return;
      seek(positionRef.current);
      running.current = true;
      setPlaying(true);
      setStarting(false);
      setNotice("");
      startup.current = null;
    } catch {
      if (token === epoch.current) {
        pause();
        seek(positionRef.current);
        setNotice(
          "A reprodução não iniciou nos dois vídeos em até 2 s. Ambos foram pausados; tente novamente.",
        );
      }
    } finally {
      removeAbort();
    }
  }
  function change(side: "left" | "right", sessionId: string) {
    pause(false);
    const original = sessions.find((s) => s.id === sessionId);
    positionRef.current = 0;
    setPosition(0);
    persist({
      ...current.current,
      [side]: {
        sessionId,
        fingerprint: original?.fingerprint ?? "",
        referenceMs: 0,
      },
      positionMs: 0,
    });
  }
  return (
    <section className="comparison-panel" aria-label="Comparação sincronizada">
      <h2>Compare dois momentos</h2>
      <p>
        Escolha um instante de referência em cada original. A reprodução alinha
        esses instantes e usa apenas a duração comum. Dois vídeos não demonstram
        evolução: atleta, contexto e amostra precisam ser comparáveis. Nenhuma
        avaliação esportiva automática é feita.
      </p>
      <div className="comparison-grid">
        {(["left", "right"] as const).map((side, i) => {
          const label = i === 0 ? "A" : "B";
          const source = sessions.find(
            (s) =>
              s.id === settings[side].sessionId &&
              s.fingerprint === settings[side].fingerprint,
          );
          return (
            <div key={side}>
              <label>
                Vídeo {label}
                <select
                  aria-label={`Vídeo ${label}`}
                  value={settings[side].sessionId}
                  onChange={(e) => change(side, e.target.value)}
                >
                  <option value="">Escolher original</option>
                  {sessions.map((s) => (
                    <option value={s.id} key={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Referência {label} (s)
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  max={durations[i] ? (durations[i] - 1) / 1000 : undefined}
                  disabled={!source}
                  value={settings[side].referenceMs / 1000}
                  onChange={(e) => {
                    const value = Number(e.target.value) * 1000;
                    if (!Number.isFinite(value) || value < 0) return;
                    pause(false);
                    positionRef.current = 0;
                    setPosition(0);
                    persist({
                      ...current.current,
                      [side]: { ...current.current[side], referenceMs: value },
                      positionMs: 0,
                    });
                  }}
                />
              </label>
              {source && (
                <p className="small">
                  {source.recordedDay || "Data não informada"} ·{" "}
                  {source.athlete || "Atleta não identificado"} ·{" "}
                  {source.group || "Grupo não informado"}
                </p>
              )}
              {urls[i] && (
                <video
                  data-testid={`compare-${label.toLowerCase()}`}
                  ref={bindPlayers.current[i]}
                  src={urls[i]}
                  playsInline
                  muted
                  preload="auto"
                  onLoadedMetadata={(e) => {
                    const duration = e.currentTarget.duration * 1000;
                    if (Number.isFinite(duration) && duration > 0)
                      setDurations((old) =>
                        old.map((d, j) => (j === i ? duration : d)),
                      );
                  }}
                  onEnded={() => {
                    if (activeWindow.current)
                      seek(activeWindow.current.durationMs);
                    pause();
                  }}
                  onError={() => {
                    pause();
                    setDurations([0, 0]);
                    setNotice(
                      `Vídeo ${label} não decodificado. Reconecte um original compatível.`,
                    );
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
      {window && (
        <p data-testid="comparison-coverage">
          A: {seconds(window.leftStartMs)}–
          {seconds(window.leftStartMs + window.durationMs)} s · B:{" "}
          {seconds(window.rightStartMs)}–
          {seconds(window.rightStartMs + window.durationMs)} s · cobertura comum{" "}
          {seconds(window.durationMs)} s · deslocamento B − A:{" "}
          {seconds(window.offsetMs)} s · dois originais locais, áudio
          silenciado.
        </p>
      )}
      {invalid && <p role="alert">{invalid}</p>}
      <input
        aria-label="Posição da comparação"
        type="range"
        min="0"
        max={window?.durationMs ?? 0}
        step="10"
        value={position}
        disabled={!window}
        onChange={(e) => {
          pause(false);
          seek(Number(e.target.value));
          persist({ ...current.current, positionMs: positionRef.current });
        }}
      />
      <p>
        {seconds(position)} / {seconds(window?.durationMs ?? 0)} s
      </p>
      <button
        disabled={!window || loading}
        onClick={() => {
          if (playing || starting) pause();
          else void play();
        }}
      >
        {starting
          ? "Cancelar início da comparação"
          : playing
            ? "Pausar comparação"
            : "Reproduzir comparação"}
      </button>
      <button
        disabled={!window || loading}
        onClick={() => {
          pause(false);
          if (window) {
            seek(window.referenceMs);
            persist({ ...current.current, positionMs: positionRef.current });
          }
        }}
      >
        Ir às referências
      </button>
      <button
        disabled={
          loading || !settings.left.sessionId || !settings.right.sessionId
        }
        onClick={() => {
          pause();
          setReload((n) => n + 1);
        }}
      >
        Recarregar originais da comparação
      </button>
      <p role="status">{notice}</p>
    </section>
  );
}
