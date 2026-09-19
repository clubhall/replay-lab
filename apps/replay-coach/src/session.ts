import { z } from "zod";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import {
  PointEventSchema,
  deriveTennisSession,
  reconcileRewardLedger,
} from "@clubhall/coach-game";

const RewardSchema = z.object({
  key: z.string(),
  sessionId: z.string(),
  ruleId: z.enum([
    "constructed-point",
    "decisive-serve",
    "under-pressure",
    "first-replay",
  ]),
  ruleVersion: z.literal(1),
  evidenceId: z.string(),
  evidenceRevision: z.number().int(),
  label: z.string(),
  xp: z.number().nonnegative(),
  athleteId: z.string().optional(),
});
const LedgerSchema = z.object({
  entries: z.array(
    z.object({
      sequence: z.number().int(),
      action: z.enum(["grant", "revoke"]),
      reward: RewardSchema,
    }),
  ),
  balance: z.number().nonnegative(),
});
export const SessionSchema = z
  .object({
    version: z.literal("coach/v1"),
    id: z.string().min(1),
    revision: z.number().int().nonnegative(),
    name: z.string().min(1),
    fingerprint: z.string().min(1),
    size: z.number().nonnegative(),
    durationMs: z.number().positive().finite(),
    demo: z.boolean(),
    athlete: z.string(),
    hand: z.enum(["right", "left"]),
    stroke: z.enum(["forehand", "backhand", "serve", "return"]),
    firstServer: z.enum(["athlete", "opponent"]).default("athlete"),
    fromMatchStart: z.boolean().default(false),
    ledger: LedgerSchema.default({ entries: [], balance: 0 }),
    events: z.array(PointEventSchema),
    startMs: z.number().nonnegative(),
    endMs: z.number().nonnegative(),
  })
  .superRefine((s, c) => {
    if (s.endMs > s.durationMs || s.startMs >= s.endMs)
      c.addIssue({ code: "custom", message: "Invalid clip interval" });
    for (const e of s.events)
      if (
        e.sessionId !== s.id ||
        e.endMs > s.durationMs ||
        (s.demo && e.state !== "demo")
      )
        c.addIssue({
          code: "custom",
          message: "Invalid event ownership or interval",
        });
  });
export type Session = z.infer<typeof SessionSchema>;
export async function fingerprint(file: Blob, signal?: AbortSignal) {
  const hash = sha256.create();
  for (let offset = 0; offset < file.size; offset += 4 * 1024 * 1024) {
    signal?.throwIfAborted();
    hash.update(
      new Uint8Array(
        await file.slice(offset, offset + 4 * 1024 * 1024).arrayBuffer(),
      ),
    );
  }
  return bytesToHex(hash.digest());
}
async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("clubhall-coach-v1", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("sessions");
      request.result.createObjectStore("media");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Storage unavailable"));
  });
}
async function transaction<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    let request: IDBRequest<T>;
    try {
      request = run(tx.objectStore(store));
    } catch (error) {
      tx.abort();
      db.close();
      reject(
        error instanceof Error ? error : new Error("Storage request failed"),
      );
      return;
    }
    tx.oncomplete = () => {
      db.close();
      resolve(request.result);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(
        tx.error ??
          request.error ??
          new Error("Armazenamento indisponível. Exporte o projeto."),
      );
    };
  });
}
export async function saveSession(session: Session) {
  await transaction("sessions", "readwrite", (s) =>
    s.put(SessionSchema.parse(session), session.id),
  );
}
export async function listSessions(): Promise<Session[]> {
  const values: unknown[] = await transaction("sessions", "readonly", (s) =>
    s.getAll(),
  );
  return values
    .map((x) => SessionSchema.safeParse(x))
    .filter((x) => x.success)
    .map((x) => x.data);
}
export async function saveMedia(
  id: string,
  file: Blob,
  hash: string,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  try {
    await transaction("media", "readwrite", (s) =>
      s.put({ blob: file, fingerprint: hash }, id),
    );
  } catch (indexedDbError) {
    signal?.throwIfAborted();
    // Some WebKit contexts cannot serialize Blob data into IndexedDB.
    // Stream into origin-private storage; retain the fingerprint in plain metadata.
    if (!navigator.storage?.getDirectory) throw indexedDbError;
    const root = await navigator.storage.getDirectory();
    const directory = await root.getDirectoryHandle("clubhall-coach-media", {
      create: true,
    });
    const opfsName = bytesToHex(
      sha256(new TextEncoder().encode(`${id}:${hash}`)),
    );
    const handle = await directory.getFileHandle(opfsName, { create: true });
    const writer = await handle.createWritable();
    try {
      await file.stream().pipeTo(writer, { signal });
      await transaction("media", "readwrite", (s) =>
        s.put({ opfsName, fingerprint: hash }, id),
      );
    } catch (error) {
      await directory.removeEntry(opfsName).catch(() => undefined);
      throw error;
    }
  }
}
export async function loadMedia(
  id: string,
  hash: string,
): Promise<Blob | undefined> {
  const stored: unknown = await transaction("media", "readonly", (s) =>
    s.get(id),
  );
  if (
    stored &&
    typeof stored === "object" &&
    "blob" in stored &&
    stored.blob instanceof Blob &&
    "fingerprint" in stored &&
    stored.fingerprint === hash
  )
    return stored.blob;
  if (
    stored &&
    typeof stored === "object" &&
    "fingerprint" in stored &&
    stored.fingerprint === hash &&
    "opfsName" in stored &&
    typeof stored.opfsName === "string"
  ) {
    try {
      const root = await navigator.storage.getDirectory();
      const directory = await root.getDirectoryHandle("clubhall-coach-media");
      const handle = await directory.getFileHandle(stored.opfsName);
      return await handle.getFile();
    } catch {
      return undefined;
    }
  }
  return undefined;
}
export function reconcileSession(raw: unknown): Session {
  const s = SessionSchema.parse(raw);
  const game = deriveTennisSession({
    sessionId: s.id,
    events: s.events,
    firstServer: s.firstServer,
    assetDurationMs: s.durationMs,
  });
  return {
    ...s,
    ledger: reconcileRewardLedger(
      s.ledger,
      game.rewards.filter(
        (r) => s.fromMatchStart || r.ruleId !== "under-pressure",
      ),
    ),
  };
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
