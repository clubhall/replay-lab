export type ClipManifestEntry = {
  segmentId: string;
  startMs: number;
  endMs: number;
  label: string;
};

export type ClipManifest = {
  version: "clip-manifest/v1";
  assetFingerprint: string;
  clips: ClipManifestEntry[];
};

export function createClipManifest(assetFingerprint: string, segments: ClipManifestEntry[]): ClipManifest {
  return {
    version: "clip-manifest/v1",
    assetFingerprint,
    clips: segments
  };
}
