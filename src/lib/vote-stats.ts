import { POINT_VALUES, VoteStats, VoteValue } from "./types";

export function computeVoteStats(votes: Record<string, VoteValue>): VoteStats {
  const numericEntries = Object.entries(votes).filter(
    (entry): entry is [string, number] => typeof entry[1] === "number"
  );

  if (numericEntries.length === 0) {
    return { average: 0, median: 0, high: 0, low: 0, outlierParticipantIds: [], isConsensus: false };
  }

  const values = numericEntries.map(([, v]) => v).sort((a, b) => a - b);
  const average = values.reduce((sum, v) => sum + v, 0) / values.length;
  const mid = Math.floor(values.length / 2);
  const median = values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid];
  const high = values[values.length - 1];
  const low = values[0];
  const isConsensus = values.every((v) => v === values[0]);

  const medianIndex = findClosestPointIndex(median);
  const outlierParticipantIds = numericEntries
    .filter(([, v]) => {
      const vIndex = findClosestPointIndex(v);
      return Math.abs(vIndex - medianIndex) > 2;
    })
    .map(([id]) => id);

  return { average, median, high, low, outlierParticipantIds, isConsensus };
}

function findClosestPointIndex(value: number): number {
  let closest = 0;
  let minDist = Math.abs(POINT_VALUES[0] - value);
  for (let i = 1; i < POINT_VALUES.length; i++) {
    const dist = Math.abs(POINT_VALUES[i] - value);
    if (dist < minDist) {
      minDist = dist;
      closest = i;
    }
  }
  return closest;
}
