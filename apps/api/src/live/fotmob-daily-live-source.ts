import type { LiveMatchSnapshot } from '@miraichi/shared';
import type { FotMobDailyClient } from '../../../worker/src/sources/fotmob/fotmob-daily-client.js';
import type { MatchSnapshotRepository } from '../repositories/match-snapshot-repository.js';
import { adaptFotMobDailyLive } from './fotmob-live-adapter.js';
import type { LiveSnapshotSource } from './live-refresh-coordinator.js';
const MAX_OBSERVATIONS = 2000;
const RETAIN_MISSING_MS = 10 * 60_000;
export class FotMobDailyLiveSource implements LiveSnapshotSource {
  constructor(private readonly daily: Pick<FotMobDailyClient, 'getDailyMatches'>) {}
  async readSnapshot(input: { observedAt: string; previousSnapshot: LiveMatchSnapshot | null; repository: MatchSnapshotRepository }): Promise<LiveMatchSnapshot> {
    const now = new Date(input.observedAt);
    const today = now.toISOString().slice(0, 10);
    const dates = now.getUTCHours() < 4 ? [new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10), today] : [today];
    const observations = new Map<string, LiveMatchSnapshot['matches'][number]>();
    const warnings: string[] = []; let upstreamCount = 0;
    for (const date of dates) {
      // Requests are sequential: an access block stops the batch before another date is fetched.
      const response = await this.daily.getDailyMatches({ date, timeZone: 'UTC', ownerCountryCode: 'JPN' });
      if (response.status !== 'modified' || response.payload.date.replaceAll('-', '') !== date.replaceAll('-', '')) {
        throw new Error('FotMob daily LIVE returned an unexpected date or uncached 304');
      }
      const canonical = await input.repository.listMatches({ date, timezone: 'UTC' });
      const adapted = adaptFotMobDailyLive({ payload: response.payload, canonicalMatches: canonical.matches, observedAt: input.observedAt });
      upstreamCount += adapted.upstreamCount;
      if (upstreamCount > MAX_OBSERVATIONS) throw new Error('FotMob daily LIVE observation bound exceeded');
      warnings.push(...adapted.warnings);
      for (const match of adapted.matches) observations.set(match.matchId, match);
    }
    const mappedCount = observations.size; let retainedTrackedCount = 0; let expired = 0;
    for (const tracked of input.previousSnapshot?.matches ?? []) {
      if (tracked.status === 'completed' || observations.has(tracked.matchId)) continue;
      if (now.getTime() - Date.parse(tracked.updatedAt) >= RETAIN_MISSING_MS) { expired++; continue; }
      observations.set(tracked.matchId, structuredClone(tracked)); retainedTrackedCount++;
    }
    if (retainedTrackedCount) warnings.push(`missing_live_observations:${retainedTrackedCount}`);
    if (expired) warnings.push(`expired_live_observations:${expired}`);
    return { schemaVersion: 'miraichi.live-match-snapshot.v1', snapshotId: `live-${input.observedAt}`, generatedAt: input.observedAt,
      coverage: { kind: 'registered-daily-window', upstreamLimit: MAX_OBSERVATIONS, upstreamCount, mappedCount,
        publishedCount: observations.size, terminalCheckCount: 0, retainedTrackedCount },
      matches: [...observations.values()], warnings: [...new Set(warnings)] };
  }
}
