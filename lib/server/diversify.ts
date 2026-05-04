/**
 * Greedy artist-diversity re-ranker for search / prompt recommendations.
 */
export function diversifyTracks<T extends { artist?: string | null }>(
  rows: T[],
  limit: number,
  windowSize = 2
): T[] {
  const result: T[] = [];
  const pool = [...rows];

  while (pool.length > 0 && result.length < limit) {
    const recentArtists = new Set(
      result.slice(-windowSize).map((r) => r.artist ?? '')
    );

    const idx = pool.findIndex((r) => !recentArtists.has(r.artist ?? ''));

    if (idx === -1) {
      result.push(pool.shift()!);
    } else {
      result.push(...pool.splice(idx, 1));
    }
  }

  return result;
}
