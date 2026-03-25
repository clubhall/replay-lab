// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReplayTimeline } from "./index";

describe("ReplayTimeline", () => {
  it("renders segments and allows range-based seeking", () => {
    const onSeek = vi.fn();
    const onSelectSegment = vi.fn();

    render(
      <ReplayTimeline
        durationMs={30_000}
        currentTimeMs={5_000}
        segments={[
          {
            id: "segment_1",
            sessionId: "session_1",
            label: "Serve candidate",
            tags: [],
            startMs: 4_000,
            endMs: 8_000,
            source: "proposal",
            accepted: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ]}
        onSeek={onSeek}
        onSelectSegment={onSelectSegment}
      />
    );

    fireEvent.change(screen.getByRole("slider"), { target: { value: "12000" } });
    expect(onSeek).toHaveBeenCalledWith(12_000);

    fireEvent.click(screen.getByRole("button", { name: /Serve candidate/i }));
    expect(onSelectSegment).toHaveBeenCalledWith("segment_1");
  });
});
