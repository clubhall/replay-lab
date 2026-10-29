import { useEffect, useRef, useState } from "react";
import { download, loadMedia, type Session } from "./session";
import {
  ReelSchema,
  RenderSchema,
  reviseReel,
  reelDuration,
  type Reel,
} from "./reel";

const KEY = "clubhall-reel-v1";
const empty = (): Reel => ({
  version: "reel/v1",
  id: crypto.randomUUID(),
  revision: 0,
  clips: [],
});
export function ReelEditor({
  session,
  sessions,
  media,
  disabled,
}: {
  session: Session | null;
  sessions: Session[];
  media: Blob | null;
  disabled: boolean;
}) {
  const [reel, setReel] = useState<Reel>(empty);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{
    url: string;
    blob: Blob;
    revision: number;
  } | null>(null);
  const operation = useRef<AbortController | null>(null);
  const current = useRef(reel);
  current.current = reel;
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setReel(ReelSchema.parse(JSON.parse(raw)));
    } catch {
      setNotice(
        "Seleção não recuperada. O registro original foi preservado; exporte uma cópia antes de substituí-lo.",
      );
    }
    return () => operation.current?.abort();
  }, []);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );
  function edit(clips: Reel["clips"]) {
    try {
      const next = reviseReel(current.current, clips);
      operation.current?.abort();
      setPreview(null);
      current.current = next;
      setReel(next);
      localStorage.setItem(KEY, JSON.stringify(next));
      setNotice(
        "Seleção salva neste navegador. Os vídeos originais não foram alterados.",
      );
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : "Não foi possível salvar a seleção.",
      );
    }
  }
  async function render() {
    const snapshot = ReelSchema.parse(current.current);
    const controller = new AbortController();
    operation.current?.abort();
    operation.current = controller;
    setBusy(true);
    setNotice("Verificando todos os originais…");
    setPreview(null);
    try {
      const blobs: Blob[] = [],
        sources: { fingerprint: string; size: number }[] = [];
      for (const clip of snapshot.clips) {
        controller.signal.throwIfAborted();
        if (sources.some((s) => s.fingerprint === clip.fingerprint)) continue;
        const original = sessions.find(
          (s) => s.id === clip.sessionId && s.fingerprint === clip.fingerprint,
        );
        if (
          !original ||
          snapshot.clips.some(
            (c) =>
              c.fingerprint === clip.fingerprint &&
              c.endMs > original.durationMs,
          )
        )
          throw new Error(`Original ou intervalo inválido: ${clip.label}`);
        const blob =
          session?.fingerprint === clip.fingerprint && media
            ? media
            : await loadMedia(original.id, original.fingerprint);
        if (!blob)
          throw new Error(
            `Reconecte o original: ${original.name}. Nenhum corte foi omitido.`,
          );
        blobs.push(blob);
        sources.push({ fingerprint: clip.fingerprint, size: blob.size });
      }
      const request = RenderSchema.parse({ reel: snapshot, sources });
      controller.signal.throwIfAborted();
      setNotice(
        `Renderizando revisão ${snapshot.revision} · 720p, 16:9 sem recorte; áudio original ou silêncio.`,
      );
      const response = await fetch("/api/coach/reel", {
        method: "POST",
        headers: {
          "X-Replay-Manifest": encodeURIComponent(JSON.stringify(request)),
        },
        body: new Blob(blobs),
        signal: controller.signal,
      });
      if (!response.ok)
        throw new Error(((await response.json()) as { error: string }).error);
      const blob = await response.blob();
      controller.signal.throwIfAborted();
      if (
        current.current.revision !== snapshot.revision ||
        operation.current !== controller
      )
        return;
      setPreview({
        blob,
        url: URL.createObjectURL(blob),
        revision: snapshot.revision,
      });
      setNotice(
        `Prévia e download usam o mesmo MP4 · revisão ${snapshot.revision}.`,
      );
    } catch (e) {
      setNotice(
        controller.signal.aborted
          ? "Render cancelado. A seleção foi preservada."
          : e instanceof Error
            ? e.message
            : "Falha ao renderizar.",
      );
    } finally {
      if (operation.current === controller) {
        operation.current = null;
        setBusy(false);
      }
    }
  }
  return (
    <section className="reel-editor" aria-label="Seleção entre vídeos">
      <h2>Seu reel</h2>
      <p>
        Escolha os intervalos e a ordem. Seleção local · sem publicação · máximo
        120 s / 1 GiB no total.
      </p>
      <button
        disabled={!session || disabled || busy || reel.clips.length >= 32}
        onClick={() => {
          if (session)
            edit([
              ...reel.clips,
              {
                id: crypto.randomUUID(),
                sessionId: session.id,
                fingerprint: session.fingerprint,
                label: session.name,
                startMs: session.startMs,
                endMs: session.endMs,
              },
            ]);
        }}
      >
        Adicionar intervalo atual ao reel
      </button>
      <ol>
        {reel.clips.map((clip, i) => (
          <li key={clip.id}>
            <strong>{clip.label}</strong>
            <label>
              Início do corte {i + 1} (s)
              <input
                type="number"
                min="0"
                step="0.1"
                disabled={busy}
                value={clip.startMs / 1000}
                onChange={(e) => {
                  const startMs = Math.round(Number(e.target.value) * 1000);
                  if (startMs >= 0 && startMs < clip.endMs)
                    edit(
                      reel.clips.map((c) =>
                        c.id === clip.id ? { ...c, startMs } : c,
                      ),
                    );
                }}
              />
            </label>
            <label>
              Fim do corte {i + 1} (s)
              <input
                type="number"
                step="0.1"
                disabled={busy}
                value={clip.endMs / 1000}
                onChange={(e) => {
                  const endMs = Math.round(Number(e.target.value) * 1000);
                  const original = sessions.find(
                    (s) => s.id === clip.sessionId,
                  );
                  if (
                    endMs > clip.startMs &&
                    original &&
                    endMs <= original.durationMs
                  )
                    edit(
                      reel.clips.map((c) =>
                        c.id === clip.id ? { ...c, endMs } : c,
                      ),
                    );
                }}
              />
            </label>
            <button
              aria-label={`Mover corte ${i + 1} para cima`}
              disabled={busy || i === 0}
              onClick={() => {
                const next = [...reel.clips];
                [next[i - 1], next[i]] = [next[i], next[i - 1]];
                edit(next);
              }}
            >
              ↑
            </button>
            <button
              aria-label={`Mover corte ${i + 1} para baixo`}
              disabled={busy || i === reel.clips.length - 1}
              onClick={() => {
                const next = [...reel.clips];
                [next[i], next[i + 1]] = [next[i + 1], next[i]];
                edit(next);
              }}
            >
              ↓
            </button>
            <button
              aria-label={`Remover corte ${i + 1}`}
              disabled={busy}
              onClick={() => edit(reel.clips.filter((c) => c.id !== clip.id))}
            >
              Remover
            </button>
          </li>
        ))}
      </ol>
      <p>
        {reel.clips.length} cortes · {(reelDuration(reel) / 1000).toFixed(1)} s
        · revisão {reel.revision}
      </p>
      <button
        disabled={!reel.clips.length || busy || disabled}
        onClick={() => void render()}
      >
        Preparar prévia MP4 do reel
      </button>
      {busy && (
        <button onClick={() => operation.current?.abort()}>
          Cancelar render do reel
        </button>
      )}
      {preview && (
        <div>
          <video
            data-testid="reel-preview"
            src={preview.url}
            controls
            playsInline
            style={{ width: "100%", aspectRatio: "16/9", objectFit: "contain" }}
          />
          <button
            onClick={() =>
              download(preview.blob, `replay-reel-r${preview.revision}.mp4`)
            }
          >
            Baixar reel MP4
          </button>
        </div>
      )}
      <button
        disabled={!reel.clips.length}
        onClick={() =>
          download(
            new Blob([JSON.stringify(reel, null, 2)], {
              type: "application/json",
            }),
            "replay-reel.json",
          )
        }
      >
        Salvar seleção JSON
      </button>
      <p role="status">{notice}</p>
    </section>
  );
}
