import { describe, it, expect } from "vitest";
import { SessionSchema, reconcileSession, fingerprint } from "./session";
const session = {
  version: "coach/v1",
  id: "s",
  revision: 1,
  name: "test",
  fingerprint: "sha",
  size: 10,
  durationMs: 8000,
  demo: false,
  athlete: "Arthur",
  hand: "right",
  stroke: "forehand",
  fromMatchStart: false,
  events: [],
  startMs: 0,
  endMs: 3000,
};
const event = {
  id: "p",
  sessionId: "s",
  revision: 1,
  ordinal: 1,
  state: "confirmed",
  startMs: 0,
  endMs: 3000,
  winner: "athlete",
  source: "manual",
  confirmedBy: "Arthur",
  evidenceIds: ["e"],
  methodVersion: "manual/v1",
  rallyContacts: 8,
};
describe("session provenance", () => {
  it("round trips schema with explicit storage metadata", () => {
    expect(
      SessionSchema.parse(JSON.parse(JSON.stringify(session))),
    ).toMatchObject(session);
  });
  it("rejects cross-session points", () => {
    expect(() =>
      SessionSchema.parse({
        ...session,
        events: [{ ...event, sessionId: "wrong" }],
      }),
    ).toThrow();
  });
  it("rejects out-of-media intervals", () => {
    expect(() => SessionSchema.parse({ ...session, endMs: 9000 })).toThrow();
    expect(() =>
      SessionSchema.parse({ ...session, events: [{ ...event, endMs: 9000 }] }),
    ).toThrow();
  });
  it("rejects converting demo media into confirmed points", () => {
    expect(() =>
      SessionSchema.parse({ ...session, demo: true, events: [event] }),
    ).toThrow();
  });
  it("rebuilds reward ledger without duplicate XP", () => {
    const first = reconcileSession({ ...session, events: [event] });
    expect(first.ledger.balance).toBe(40);
    expect(reconcileSession(first).ledger).toEqual(first.ledger);
    const corrected = reconcileSession({
      ...first,
      events: [event, { ...event, revision: 2, rallyContacts: 3 }],
    });
    expect(corrected.ledger.balance).toBe(0);
    expect(corrected.ledger.entries.at(-1)?.action).toBe("revoke");
  });
  it("hashes content independently of name and catches changed media", async () => {
    expect(await fingerprint(new Blob(["abc"]))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(await fingerprint(new Blob(["abd"]))).not.toBe(
      await fingerprint(new Blob(["abc"])),
    );
  });
  it("honors cancellation before hashing", async () => {
    const c = new AbortController();
    c.abort();
    await expect(fingerprint(new Blob(["x"]), c.signal)).rejects.toThrow();
  });
});
