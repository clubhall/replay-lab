import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { loadMedia, type Session } from "./session";
import { VisualIndexSchema } from "./visual-index";
const SavedSchema = z.object({
  indexes: z.record(z.string(), VisualIndexSchema),
  corrections: z.record(
    z.string(),
    z.object({ label: z.string(), rejected: z.boolean() }),
  ),
});
type Saved = z.infer<typeof SavedSchema>;
export function VisualIndexPanel({
  session,
  sessions,
  media,
  select,
}: {
  session: Session | null;
  sessions: Session[];
  media: Blob | null;
  select: (startMs: number, endMs: number) => void;
}) {
  const [saved, setSaved] = useState<Saved>({ indexes: {}, corrections: {} });
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const snapshot = useRef(saved);
  const operation = useRef<AbortController | null>(null);
  snapshot.current = saved;
  useEffect(() => {
    try {
      const data = localStorage.getItem("clubhall-visual-index-v1");
      if (data) setSaved(SavedSchema.parse(JSON.parse(data)));
    } catch {
      setNotice(
        "Índice salvo não recuperado. As anotações originais permanecem na coleção.",
      );
    }
    return () => operation.current?.abort();
  }, []);
  function persist(next: Saved) {
    snapshot.current = next;
    setSaved(next);
    localStorage.setItem("clubhall-visual-index-v1", JSON.stringify(next));
  }
  async function analyze(batch: Session[], force = false) {
    operation.current?.abort();
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    let done = 0;
    const failures: string[] = [];
    for (const [i, source] of batch.entries()) {
      if (controller.signal.aborted) break;
      if (!force && snapshot.current.indexes[source.fingerprint]) {
        done++;
        continue;
      }
      setNotice(`Analisando ${i + 1}/${batch.length}: ${source.name}`);
      try {
        const blob =
          source.fingerprint === session?.fingerprint && media
            ? media
            : await loadMedia(source.id, source.fingerprint);
        if (!blob) throw new Error("Reconecte o original");
        if (blob.size > 1024 ** 3) throw new Error("Limite local de 1 GiB");
        controller.signal.throwIfAborted();
        const response = await fetch("/api/coach/index", {
          method: "POST",
          headers: { "X-Source-Fingerprint": source.fingerprint },
          body: blob,
          signal: controller.signal,
        });
        const data: unknown = await response.json();
        if (!response.ok)
          throw new Error("Análise indisponível para este original");
        const index = VisualIndexSchema.parse(data);
        controller.signal.throwIfAborted();
        if (
          index.fingerprint !== source.fingerprint ||
          operation.current !== controller
        )
          throw new Error("Resposta de outra fonte descartada");
        persist({
          ...snapshot.current,
          indexes: { ...snapshot.current.indexes, [source.fingerprint]: index },
        });
        done++;
      } catch (e) {
        if (!controller.signal.aborted)
          failures.push(
            `${source.name}: ${e instanceof Error ? e.message : "Falha"}`,
          );
      }
    }
    if (operation.current === controller) {
      setBusy(false);
      operation.current = null;
      setNotice(
        `${controller.signal.aborted ? "Interrompido" : "Lote analisado"}: ${done}/${batch.length} índices disponíveis. ${failures.join("; ")}`,
      );
    }
  }
  const index = session ? saved.indexes[session.fingerprint] : undefined;
  return (
    <section className="visual-index" aria-label="Índice visual experimental">
      <h2>Encontrar mudanças visuais</h2>
      <p>
        Decodifica os primeiros 120 s de cada original, 2 imagens/s. Detecta
        mudanças de luminosidade/câmera; não identifica golpes, erros,
        vencedores ou atletas. Limiar experimental, sem avaliação em partidas
        reais.
      </p>
      <button
        disabled={busy || !sessions.length}
        onClick={() => void analyze(sessions)}
      >
        Analisar lote disponível
      </button>
      <button
        disabled={busy || !session}
        onClick={() => {
          if (session) void analyze([session], true);
        }}
      >
        Reanalisar vídeo atual
      </button>
      {busy && (
        <button onClick={() => operation.current?.abort()}>
          Cancelar análise
        </button>
      )}
      <p role="status">{notice}</p>
      {index && (
        <>
          <p>
            {index.version} · {index.sampledFps} imagens/s ·{" "}
            {(index.coverageMs / 1000).toFixed(1)} s observados · execução{" "}
            {index.runId.slice(0, 8)}
          </p>
          {!index.candidates.length && (
            <p>
              Nenhuma mudança acima do limiar. Isso não significa ausência de
              momentos esportivos; use a marcação manual.
            </p>
          )}
          {index.candidates.map((c) => {
            const correction = saved.corrections[c.id] ?? {
              label: "Mudança visual — revisar",
              rejected: false,
            };
            return (
              <div key={c.id}>
                <button
                  disabled={correction.rejected || !session}
                  onClick={() => {
                    if (session)
                      select(c.startMs, Math.min(session.durationMs, c.endMs));
                  }}
                >
                  {(c.startMs / 1000).toFixed(1)}–{(c.endMs / 1000).toFixed(1)}{" "}
                  s · diferença {(c.changeScore * 100).toFixed(1)}%
                </button>
                <label>
                  Nota sobre mudança em {(c.startMs / 1000).toFixed(1)} s
                  <input
                    value={correction.label}
                    onChange={(e) => {
                      try {
                        persist({
                          ...snapshot.current,
                          corrections: {
                            ...snapshot.current.corrections,
                            [c.id]: { ...correction, label: e.target.value },
                          },
                        });
                      } catch {
                        setNotice(
                          "Correção não salva; armazenamento indisponível.",
                        );
                      }
                    }}
                  />
                </label>
                <button
                  onClick={() => {
                    try {
                      persist({
                        ...snapshot.current,
                        corrections: {
                          ...snapshot.current.corrections,
                          [c.id]: {
                            ...correction,
                            rejected: !correction.rejected,
                          },
                        },
                      });
                    } catch {
                      setNotice(
                        "Correção não salva; armazenamento indisponível.",
                      );
                    }
                  }}
                >
                  {correction.rejected
                    ? "Restaurar candidato"
                    : "Rejeitar candidato"}
                </button>
              </div>
            );
          })}
        </>
      )}
    </section>
  );
}
