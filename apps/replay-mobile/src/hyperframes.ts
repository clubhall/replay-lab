import type { Session } from "./replay-store";
const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
/** Portable HyperFrames composition. Supply the original recording as source.mp4 before rendering. */
export function composition(session: Session, style: "original" | "club") {
  const moments = session.moments.length
    ? session.moments
    : [{ title: session.title, start: 0, end: session.duration }];
  let cursor = 0;
  const clips = moments.map((moment, i) => {
    const duration = moment.end - moment.start;
    const start = cursor;
    cursor += duration;
    return `<video id="clip-${i}" src="source.mp4" data-start="${start}" data-duration="${duration}" data-media-start="${moment.start}" data-track-index="0" style="position:absolute;width:100%;height:100%;object-fit:contain"></video>${style === "club" ? `\n<div data-start="${start}" data-duration="${duration}" data-track-index="1" style="position:absolute;left:72px;bottom:64px;z-index:2;color:#f6f6ee;font:500 42px system-ui;border-bottom:4px solid #e6cb87;padding-bottom:18px;text-shadow:0 2px 12px #000">${escape(moment.title)}<small style="display:block;font-size:14px;letter-spacing:5px;margin-top:12px">CLUBHALL REPLAY</small></div>` : ""}`;
  });
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escape(session.title)}</title><style>body{margin:0;background:#101312}</style></head><body><div data-composition-id="clubhall-replay" data-width="1920" data-height="1080" data-duration="${cursor}" style="position:relative;width:1920px;height:1080px;overflow:hidden">${clips.join("\n")}</div></body></html>`;
}
