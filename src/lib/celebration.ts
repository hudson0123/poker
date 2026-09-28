/**
 * Picks an index in [0, count) from a seed string (FNV-1a hash). Seeding with
 * the ticket and round means every client watching the same reveal plays the
 * same animation, while each new reveal still gets an effectively random one.
 */
export function pickCelebrationIndex(seed: string, count: number): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % count;
}
