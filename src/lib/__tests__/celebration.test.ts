import { pickCelebrationIndex } from "../celebration";

describe("pickCelebrationIndex", () => {
  it("picks the same index for the same seed, so every client plays the same animation", () => {
    expect(pickCelebrationIndex("ticket-abc:1", 5)).toBe(pickCelebrationIndex("ticket-abc:1", 5));
  });

  it("always returns an index within range", () => {
    for (let i = 0; i < 500; i++) {
      const index = pickCelebrationIndex(`ticket-${i}:1`, 5);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(5);
      expect(Number.isInteger(index)).toBe(true);
    }
  });

  it("spreads different seeds across every animation", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 100; i++) seen.add(pickCelebrationIndex(`ticket-${i}:1`, 5));
    expect(seen.size).toBe(5);
  });

  it("changes with the round, so a re-vote can get a different animation", () => {
    const rounds = new Set<number>();
    for (let round = 1; round <= 20; round++) rounds.add(pickCelebrationIndex(`ticket-abc:${round}`, 5));
    expect(rounds.size).toBeGreaterThan(1);
  });
});
