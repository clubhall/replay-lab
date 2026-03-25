import Dexie, { type Table } from "dexie";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { create } from "zustand";
import {
  ClubhallReplayExportV1Schema,
  EngineOutputSchema,
  createSessionExport,
  mergeEngineOutputIntoDocument,
  parseSessionExport,
  restoreDocumentFromExport
} from "@clubhall/analysis-contracts";
import {
  ReplaySessionDocumentSchema,
  SegmentSchema,
  VideoAssetSchema,
  createSegment,
  createSessionDocument,
  mergeSessionDocument,
  nowIso,
  sortSegments,
  upsertById,
  type EngineRun,
  type EngineRunTarget,
  type OverlayLayer,
  type ReplaySessionDocument,
  type Segment,
  type VideoAsset
} from "@clubhall/video-domain";

type PersistedSessionRecord = {
  id: string;
  title: string;
  updatedAt: string;
  assetFingerprint: string;
  assetName: string;
  requiresRelink: boolean;
  document: ReplaySessionDocument;
};

type AppSettings = {
  id: "app";
  lastSessionId?: string;
};

type SessionSummary = Omit<PersistedSessionRecord, "document">;

class ReplayDatabase extends Dexie {
  documents!: Table<PersistedSessionRecord, string>;
  settings!: Table<AppSettings, string>;

  constructor() {
    super("clubhall-replay");
    this.version(1).stores({
      documents: "id, updatedAt, assetFingerprint",
      settings: "id"
    });
  }
}

const database = new ReplayDatabase();
const objectUrlCache = new Map<string, string>();

type ReplayStoreState = {
  document: ReplaySessionDocument | null;
  assetUrl: string | null;
  playback: {
    currentTimeMs: number;
    isPlaying: boolean;
  };
  thumbnails: Record<string, string>;
  serviceUrl: string;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  initialize: () => Promise<void>;
  createSessionFromFile: (file: File) => Promise<ReplaySessionDocument>;
  loadSession: (sessionId: string) => Promise<void>;
  relinkAsset: (file: File) => Promise<void>;
  importSessionExport: (data: unknown, file?: File) => Promise<ReplaySessionDocument>;
  exportCurrentSession: () => Promise<string>;
  importAnnotationOutput: (data: unknown) => Promise<void>;
  setPlaybackTime: (timeMs: number) => void;
  setPlayState: (isPlaying: boolean) => void;
  updateAssetMetadata: (metadata: { durationMs: number; width: number; height: number }) => Promise<void>;
  addSegment: (startMs: number, endMs: number, label?: string, source?: Segment["source"]) => Promise<Segment>;
  updateSegment: (segmentId: string, patch: Partial<Segment>) => Promise<void>;
  deleteSegment: (segmentId: string) => Promise<void>;
  selectSegment: (segmentId?: string) => Promise<void>;
  setOverlayVisibility: (layerId: string, visible: boolean) => Promise<void>;
  upsertOverlayLayer: (layer: OverlayLayer) => Promise<void>;
  upsertEngineRun: (run: EngineRun) => Promise<void>;
  completeEngineRun: (run: EngineRun, output: unknown) => Promise<void>;
  setThumbnail: (segmentId: string, dataUrl: string) => void;
  setServiceUrl: (serviceUrl: string) => void;
};

export const useReplayStore = create<ReplayStoreState>((set, get) => ({
  document: null,
  assetUrl: null,
  playback: {
    currentTimeMs: 0,
    isPlaying: false
  },
  thumbnails: {},
  serviceUrl: "http://127.0.0.1:8000",
  status: "idle",
  error: null,
  async initialize() {
    set({ status: "loading", error: null });
    const settings = await database.settings.get("app");
    if (settings?.lastSessionId) {
      await get().loadSession(settings.lastSessionId);
      return;
    }
    set({ status: "ready" });
  },
  async createSessionFromFile(file) {
    set({ status: "loading", error: null });
    const asset = await createVideoAsset(file);
    const document = createSessionDocument(asset);
    await persistDocument(document);
    const assetUrl = await resolveAssetUrl(document.asset, file);
    set({
      document,
      assetUrl,
      playback: { currentTimeMs: 0, isPlaying: false },
      thumbnails: {},
      status: "ready",
      error: null
    });
    await database.settings.put({ id: "app", lastSessionId: document.session.id });
    return document;
  },
  async loadSession(sessionId) {
    set({ status: "loading", error: null });
    const record = await database.documents.get(sessionId);
    if (!record) {
      set({ status: "error", error: `Session ${sessionId} not found` });
      return;
    }
    const assetUrl = await resolveAssetUrl(record.document.asset);
    set({
      document: record.document,
      assetUrl,
      playback: {
        currentTimeMs: record.document.session.lastViewedTimeMs,
        isPlaying: false
      },
      thumbnails: {},
      status: "ready",
      error: null
    });
    await database.settings.put({ id: "app", lastSessionId: sessionId });
  },
  async relinkAsset(file) {
    const { document } = get();
    if (!document) {
      return;
    }
    const fingerprint = await hashFile(file);
    if (fingerprint !== document.asset.fingerprint) {
      throw new Error("Selected file fingerprint does not match this session.");
    }

    const storage = await persistFileToOpfs(document.asset.id, file);
    const nextDocument = mergeSessionDocument(document, {
      asset: {
        storage: {
          ...storage,
          fileName: file.name,
          relinkRequired: false
        }
      }
    });
    await persistDocument(nextDocument);
    const assetUrl = await resolveAssetUrl(nextDocument.asset, file);
    set({ document: nextDocument, assetUrl, status: "ready" });
  },
  async importSessionExport(data, file) {
    const parsed = parseSessionExport(data);
    let asset: VideoAsset;
    if (file) {
      const candidate = await createVideoAsset(file);
      if (candidate.fingerprint !== parsed.assetFingerprint) {
        throw new Error("Imported video fingerprint does not match the export manifest.");
      }
      asset = candidate;
    } else {
      asset = VideoAssetSchema.parse({
        ...parsed.asset,
        id: `asset_${parsed.assetFingerprint.slice(0, 12)}`,
        storage: {
          kind: "external",
          fileName: parsed.asset.storageHint.fileName,
          relinkRequired: true
        }
      });
    }
    const document = restoreDocumentFromExport(parsed, asset);
    await persistDocument(document);
    const assetUrl = file ? await resolveAssetUrl(document.asset, file) : null;
    set({
      document,
      assetUrl,
      playback: { currentTimeMs: document.session.lastViewedTimeMs, isPlaying: false },
      thumbnails: {},
      status: "ready",
      error: null
    });
    await database.settings.put({ id: "app", lastSessionId: document.session.id });
    return document;
  },
  async exportCurrentSession() {
    const { document } = get();
    if (!document) {
      throw new Error("No session is loaded.");
    }
    const exportBundle = createSessionExport(document);
    return JSON.stringify(exportBundle, null, 2);
  },
  async importAnnotationOutput(data) {
    const { document } = get();
    if (!document) {
      return;
    }

    const parsedExport = ClubhallReplayExportV1Schema.safeParse(data);
    if (parsedExport.success) {
      const filelessAsset = mergeSessionDocument(document, {
        tracks: parsedExport.data.tracks,
        poseFrames: parsedExport.data.poseFrames,
        insights: parsedExport.data.insights,
        segments: sortSegments([...document.segments, ...parsedExport.data.segments]),
        engineRuns: parsedExport.data.engineRuns,
        overlayLayers: parsedExport.data.overlayLayers
      });
      await persistDocument(filelessAsset);
      set({ document: filelessAsset });
      return;
    }

    const output = EngineOutputSchema.parse(data);
    const run = document.engineRuns.at(-1);
    if (!run) {
      throw new Error("Import an engine run after creating or selecting a run.");
    }
    const nextDocument = mergeEngineOutputIntoDocument(document, run, output);
    await persistDocument(nextDocument);
    set({ document: nextDocument });
  },
  setPlaybackTime(timeMs) {
    set((state) => ({
      playback: {
        ...state.playback,
        currentTimeMs: timeMs
      }
    }));
  },
  setPlayState(isPlaying) {
    const document = get().document;
    if (document) {
      void persistDocument(
        mergeSessionDocument(document, {
          session: {
            lastViewedTimeMs: get().playback.currentTimeMs
          }
        })
      );
    }
    set((state) => ({
      playback: {
        ...state.playback,
        isPlaying
      }
    }));
  },
  async updateAssetMetadata(metadata) {
    const { document } = get();
    if (!document) {
      return;
    }
    const nextDocument = mergeSessionDocument(document, {
      asset: metadata
    });
    await persistDocument(nextDocument);
    set({ document: nextDocument });
  },
  async addSegment(startMs, endMs, label, source = "manual") {
    const { document } = get();
    if (!document) {
      throw new Error("No session loaded");
    }
    const segment = createSegment(document.session.id, startMs, endMs, label, source);
    const nextDocument = mergeSessionDocument(document, {
      segments: sortSegments([...document.segments, segment]),
      session: {
        selectedSegmentId: segment.id
      }
    });
    await persistDocument(nextDocument);
    set({
      document: nextDocument,
      playback: {
        ...get().playback,
        currentTimeMs: segment.startMs
      }
    });
    return segment;
  },
  async updateSegment(segmentId, patch) {
    const { document } = get();
    if (!document) {
      return;
    }
    const nextSegments = document.segments.map((segment) =>
      segment.id === segmentId
        ? SegmentSchema.parse({
            ...segment,
            ...patch,
            updatedAt: nowIso()
          })
        : segment
    );
    const nextDocument = mergeSessionDocument(document, { segments: sortSegments(nextSegments) });
    await persistDocument(nextDocument);
    set({ document: nextDocument });
  },
  async deleteSegment(segmentId) {
    const { document } = get();
    if (!document) {
      return;
    }
    const nextDocument = mergeSessionDocument(document, {
      segments: document.segments.filter((segment) => segment.id !== segmentId),
      session: {
        selectedSegmentId: document.session.selectedSegmentId === segmentId ? undefined : document.session.selectedSegmentId
      }
    });
    await persistDocument(nextDocument);
    set({ document: nextDocument });
  },
  async selectSegment(segmentId) {
    const { document } = get();
    if (!document) {
      return;
    }
    const selected = document.segments.find((segment) => segment.id === segmentId);
    const nextDocument = mergeSessionDocument(document, {
      session: {
        selectedSegmentId: segmentId
      }
    });
    await persistDocument(nextDocument);
    set({
      document: nextDocument,
      playback: {
        ...get().playback,
        currentTimeMs: selected?.startMs ?? get().playback.currentTimeMs
      }
    });
  },
  async setOverlayVisibility(layerId, visible) {
    const { document } = get();
    if (!document) {
      return;
    }
    const nextDocument = mergeSessionDocument(document, {
      overlayLayers: document.overlayLayers.map((layer) => (layer.id === layerId ? { ...layer, visible } : layer))
    });
    await persistDocument(nextDocument);
    set({ document: nextDocument });
  },
  async upsertOverlayLayer(layer) {
    const { document } = get();
    if (!document) {
      return;
    }
    const nextDocument = mergeSessionDocument(document, {
      overlayLayers: upsertById(document.overlayLayers, layer)
    });
    await persistDocument(nextDocument);
    set({ document: nextDocument });
  },
  async upsertEngineRun(run) {
    const { document } = get();
    if (!document) {
      return;
    }
    const nextDocument = mergeSessionDocument(document, {
      engineRuns: upsertById(document.engineRuns, run),
      session: {
        engineRunIds: Array.from(new Set([...document.session.engineRunIds, run.id]))
      }
    });
    await persistDocument(nextDocument);
    set({ document: nextDocument });
  },
  async completeEngineRun(run, output) {
    const { document } = get();
    if (!document) {
      return;
    }
    const nextDocument = mergeEngineOutputIntoDocument(document, run, EngineOutputSchema.parse(output));
    await persistDocument(nextDocument);
    set({ document: nextDocument });
  },
  setThumbnail(segmentId, dataUrl) {
    set((state) => ({
      thumbnails: {
        ...state.thumbnails,
        [segmentId]: dataUrl
      }
    }));
  },
  setServiceUrl(serviceUrl) {
    set({ serviceUrl });
  }
}));

export async function listPersistedSessions(): Promise<SessionSummary[]> {
  const records = await database.documents.orderBy("updatedAt").reverse().toArray();
  return records.map(({ document, ...summary }) => summary);
}

export async function readJsonFile<T>(file: File): Promise<T> {
  return JSON.parse(await file.text()) as T;
}

async function persistDocument(document: ReplaySessionDocument) {
  const normalized = ReplaySessionDocumentSchema.parse(document);
  await database.documents.put({
    id: normalized.session.id,
    title: normalized.session.title,
    updatedAt: normalized.session.updatedAt,
    assetFingerprint: normalized.asset.fingerprint,
    assetName: normalized.asset.name,
    requiresRelink: normalized.asset.storage.relinkRequired,
    document: normalized
  });
}

async function createVideoAsset(file: File): Promise<VideoAsset> {
  const timestamp = nowIso();
  const fingerprint = await hashFile(file);
  const storage = await persistFileToOpfs(fingerprint, file);
  const metadata = await readVideoMetadata(file);
  return VideoAssetSchema.parse({
    id: `asset_${fingerprint.slice(0, 12)}`,
    fingerprint,
    name: file.name,
    mimeType: file.type || "video/mp4",
    sizeBytes: file.size,
    durationMs: metadata.durationMs,
    width: metadata.width,
    height: metadata.height,
    createdAt: timestamp,
    updatedAt: timestamp,
    storage: {
      ...storage,
      fileName: file.name
    }
  });
}

async function resolveAssetUrl(asset: VideoAsset, fallbackFile?: File) {
  const cached = objectUrlCache.get(asset.id);
  if (cached) {
    return cached;
  }

  const file = fallbackFile ?? (await readAssetFile(asset));
  if (!file) {
    return null;
  }
  const url = URL.createObjectURL(file);
  objectUrlCache.set(asset.id, url);
  return url;
}

async function persistFileToOpfs(assetKey: string, file: File) {
  const directory = await getOpfsDirectory();
  if (!directory) {
    return {
      kind: "external" as const,
      fileName: file.name,
      relinkRequired: true
    };
  }

  const videosDirectory = await directory.getDirectoryHandle("videos", { create: true });
  const extension = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : ".bin";
  const fileHandle = await videosDirectory.getFileHandle(`${assetKey}${extension}`, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(file);
  await writable.close();
  return {
    kind: "opfs" as const,
    opfsPath: `videos/${assetKey}${extension}`,
    fileName: file.name,
    relinkRequired: false
  };
}

async function readAssetFile(asset: VideoAsset) {
  if (asset.storage.kind !== "opfs" || !asset.storage.opfsPath) {
    return null;
  }
  const directory = await getOpfsDirectory();
  if (!directory) {
    return null;
  }
  const [folderName, fileName] = asset.storage.opfsPath.split("/");
  const folder = await directory.getDirectoryHandle(folderName);
  const handle = await folder.getFileHandle(fileName);
  return handle.getFile();
}

async function getOpfsDirectory() {
  if (typeof navigator === "undefined" || !navigator.storage || !("getDirectory" in navigator.storage)) {
    return null;
  }
  return navigator.storage.getDirectory();
}

async function hashFile(file: File) {
  const digest = sha256.create();
  const reader = file.stream().getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    digest.update(value);
  }
  return bytesToHex(digest.digest());
}

function readVideoMetadata(file: File) {
  return new Promise<{ durationMs: number; width: number; height: number }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = url;
    const cleanup = () => {
      URL.revokeObjectURL(url);
    };
    video.onloadedmetadata = () => {
      resolve({
        durationMs: video.duration * 1000,
        width: video.videoWidth,
        height: video.videoHeight
      });
      cleanup();
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("Failed to read video metadata."));
    };
  });
}

export type { SessionSummary, EngineRunTarget };
