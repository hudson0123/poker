import { computeVoteStats } from "../vote-stats";
import { VoteValue, parseJiraKey, buildJiraUrl } from "../types";

describe("computeVoteStats", () => {
  it("computes basic stats for numeric votes", () => {
    const votes: Record<string, VoteValue> = { a: 3, b: 5, c: 8 };
    const stats = computeVoteStats(votes);
    expect(stats.average).toBeCloseTo(5.33, 1);
    expect(stats.median).toBe(5);
    expect(stats.high).toBe(8);
    expect(stats.low).toBe(3);
    expect(stats.isConsensus).toBe(false);
  });

  it("detects consensus", () => {
    const votes: Record<string, VoteValue> = { a: 5, b: 5, c: 5 };
    const stats = computeVoteStats(votes);
    expect(stats.isConsensus).toBe(true);
    expect(stats.average).toBe(5);
    expect(stats.median).toBe(5);
  });

  it("excludes special values from stats", () => {
    const votes: Record<string, VoteValue> = { a: 3, b: "?", c: 5, d: "☕" };
    const stats = computeVoteStats(votes);
    expect(stats.average).toBe(4);
    expect(stats.median).toBe(4);
    expect(stats.high).toBe(5);
    expect(stats.low).toBe(3);
  });

  it("returns zeros when no numeric votes", () => {
    const votes: Record<string, VoteValue> = { a: "?", b: "☕" };
    const stats = computeVoteStats(votes);
    expect(stats.average).toBe(0);
    expect(stats.median).toBe(0);
    expect(stats.isConsensus).toBe(false);
  });

  it("returns zeros for empty votes", () => {
    const stats = computeVoteStats({});
    expect(stats.average).toBe(0);
    expect(stats.isConsensus).toBe(false);
  });

  it("identifies outliers 2+ fibonacci steps from median", () => {
    // POINT_VALUES = [1, 2, 3, 5, 8, 13, 21]
    // Median is 5, index 3. Two steps away: index 1 (2) or index 5 (13)
    // So 1 and 21 are outliers, 2 and 13 are borderline (exactly 2 steps)
    const votes: Record<string, VoteValue> = {
      a: 1,  // index 0, median index 3 => 3 steps away => outlier
      b: 5,  // median
      c: 5,  // median
      d: 5,  // median
      e: 21, // index 6, median index 3 => 3 steps away => outlier
    };
    const stats = computeVoteStats(votes);
    expect(stats.outlierParticipantIds).toContain("a");
    expect(stats.outlierParticipantIds).toContain("e");
    expect(stats.outlierParticipantIds).not.toContain("b");
  });

  it("handles single vote", () => {
    const votes: Record<string, VoteValue> = { a: 8 };
    const stats = computeVoteStats(votes);
    expect(stats.average).toBe(8);
    expect(stats.median).toBe(8);
    expect(stats.isConsensus).toBe(true);
    expect(stats.outlierParticipantIds).toEqual([]);
  });
});

describe("parseJiraKey", () => {
  it("extracts key from Jira browse URL", () => {
    expect(parseJiraKey("https://talkiatry.atlassian.net/browse/TA2-1234")).toBe("TA2-1234");
  });

  it("extracts bare key", () => {
    expect(parseJiraKey("TA2-1234")).toBe("TA2-1234");
  });

  it("returns null for non-matching input", () => {
    expect(parseJiraKey("just a title")).toBeNull();
    expect(parseJiraKey("https://example.com")).toBeNull();
  });

  it("handles keys with long project prefixes", () => {
    expect(parseJiraKey("DOLCE-2047")).toBe("DOLCE-2047");
  });
});

describe("buildJiraUrl", () => {
  it("builds URL from base and key", () => {
    expect(buildJiraUrl("talkiatry.atlassian.net", "TA2-1234"))
      .toBe("https://talkiatry.atlassian.net/browse/TA2-1234");
  });

  it("handles base URL with protocol", () => {
    expect(buildJiraUrl("https://talkiatry.atlassian.net", "TA2-1234"))
      .toBe("https://talkiatry.atlassian.net/browse/TA2-1234");
  });

  it("strips trailing slashes", () => {
    expect(buildJiraUrl("talkiatry.atlassian.net/", "TA2-1234"))
      .toBe("https://talkiatry.atlassian.net/browse/TA2-1234");
  });
});
