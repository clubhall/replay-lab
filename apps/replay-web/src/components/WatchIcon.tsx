import type { CSSProperties } from "react";

export type WatchIconName =
  | "play"
  | "pause"
  | "back"
  | "forward"
  | "bookmark"
  | "speed"
  | "loop"
  | "expand"
  | "plus"
  | "arrow"
  | "close"
  | "check"
  | "download"
  | "edit"
  | "folder"
  | "volume";
const paths: Record<WatchIconName, string> = {
  play: "m8 5 11 7-11 7Z",
  pause: "M8 5v14M16 5v14",
  back: "M3 10a9 9 0 1 1 1 8M3 4v6h6M13 8h-4v4h3a2 2 0 0 1 0 4H9",
  forward: "M21 10a9 9 0 1 0-1 8M21 4v6h-6M14 8h-4v4h3a2 2 0 0 1 0 4h-3",
  bookmark: "M6 3h12v18l-6-4-6 4Z",
  speed: "M4 19a10 10 0 1 1 16 0M12 3v3M3 12h3M18 12h3M12 14l5-7",
  loop: "M4 8h15l-4-4M20 16H5l4 4M20 8v4M4 16v-4",
  expand: "M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5",
  plus: "M12 4v16M4 12h16",
  arrow: "m9 5 7 7-7 7",
  close: "m6 6 12 12M6 18 18 6",
  check: "m5 12 4 4L19 6",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  edit: "m4 16 12-12 4 4L8 20H4ZM14 6l4 4",
  folder: "M3 6h7l2 3h9v11H3Z",
  volume: "m3 9 4 0 5-5v16l-5-5H3ZM16 8a6 6 0 0 1 0 8M19 5a10 10 0 0 1 0 14",
};
export function WatchIcon({
  name,
  size = 22,
  style,
}: {
  name: WatchIconName;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={name === "play" ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      <path d={paths[name]} />
    </svg>
  );
}
