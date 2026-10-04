import type { LocalDataSnapshotStatus } from '@miraichi/shared';

export const MATCH_SNAPSHOT_STALE_AFTER_MS = 12 * 60 * 60 * 1000;

export function classifyMatchSnapshotFreshness(
  generatedAt: string,
  now: Date | string | number
): Exclude<LocalDataSnapshotStatus['freshness'], 'missing'> {
  const ageMs = new Date(now).getTime() - new Date(generatedAt).getTime();
  return ageMs <= MATCH_SNAPSHOT_STALE_AFTER_MS ? 'fresh' : 'stale';
}
