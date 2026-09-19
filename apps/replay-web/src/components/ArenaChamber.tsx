import { WatchIcon } from "./WatchIcon";

export function ArenaChamber({
  isPlaying,
  isReviewing,
  hasVideo,
  momentCount,
  notice,
  onReview,
  onMoments,
  onPractice,
}: {
  isPlaying: boolean;
  isReviewing: boolean;
  hasVideo: boolean;
  momentCount: number;
  notice: string;
  onReview: () => void;
  onMoments: () => void;
  onPractice: () => void;
}) {
  return (
    <aside className="replay-companion" aria-label="Arena replay companion">
      <button
        className={`arena-chamber ${isPlaying ? "is-watching" : ""} ${isReviewing ? "is-reviewing" : ""}`}
        onClick={onPractice}
        aria-label="Open Arena practice guide"
      >
        <img className="chamber-room" src="/assets/arena-chamber.png" alt="" />
        <span className="chamber-light" />
        <span className="arena-floor-shadow" />
        <img
          className="chamber-arena"
          src="/assets/arena.webp"
          alt="Golden ClubHall arena floating in its own sunlit chamber"
        />
        <span className="chamber-engraving">ARENA</span>
        <span className="chamber-state">
          <i />
          {isReviewing
            ? "A closer look"
            : isPlaying
              ? "Here with you"
              : "Your space to replay"}
        </span>
      </button>
      <div className="companion-copy">
        <span className="watch-eyebrow">YOUR REPLAY COMPANION</span>
        <h2>
          {isReviewing
            ? "There’s more in the moment."
            : "A little closer to your game."}
        </h2>
        <p>
          {isReviewing
            ? "Notice one thing. Keep it for your next time on court."
            : "Save a moment. Slow it down. See it differently."}
        </p>
        <div className="companion-actions">
          <button onClick={onMoments}>
            <WatchIcon name="bookmark" />
            <span>
              {momentCount
                ? `Explore ${momentCount} saved ${momentCount === 1 ? "moment" : "moments"}`
                : "Find a moment"}
            </span>
            <WatchIcon name="arrow" size={18} />
          </button>
          <button onClick={onReview} disabled={!hasVideo}>
            <WatchIcon name="speed" />
            <span>Review in slow motion</span>
            <WatchIcon name="arrow" size={18} />
          </button>
        </div>
        <p className="arena-notice" role="status">
          {notice || "Your first replay starts here."}
        </p>
      </div>
    </aside>
  );
}
