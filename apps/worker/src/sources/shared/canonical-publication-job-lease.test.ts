import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runFotMobTerminalResultJob } from '../../jobs/fotmob-terminal-result-job.js';
import { runSeasonHydrationJob } from '../../jobs/season-hydration-job.js';
import { CanonicalPublicationJobLease } from './canonical-publication-job-lease.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('shared canonical publication lease', () => {
  it('prevents season and terminal pipelines from running against the same stale base', async () => {
    const dataRoot = await mkdtemp(path.join(os.tmpdir(), 'miraichi-canonical-lease-'));
    roots.push(dataRoot);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let entered!: () => void;
    const acquired = new Promise<void>((resolve) => { entered = resolve; });
    const holding = new CanonicalPublicationJobLease({ dataRoot }).tryWithLease(async () => {
      entered();
      await gate;
      return 'released';
    });
    await acquired;
    const dailyClient = { getDailyMatches: vi.fn() };
    const seasonClient = { getSeasonMatches: vi.fn() };

    const [terminal, season] = await Promise.all([
      runFotMobTerminalResultJob({
        dataRoot,
        client: dailyClient,
        timeZone: 'Asia/Tokyo',
        ownerCountryCode: 'JPN',
        now: () => new Date('2026-08-31T14:00:00.000Z')
      }),
      runSeasonHydrationJob({
        dataRoot,
        fotMobClient: seasonClient,
        referenceDate: '2026-08-31',
        pastSeasons: 0,
        maxRequestsPerRun: 1,
        now: () => new Date('2026-08-31T14:00:00.000Z')
      })
    ]);

    expect(terminal).toMatchObject({ status: 'lease_busy', requestsAttempted: 0 });
    expect(season).toMatchObject({ status: 'lease_busy', requestsAttempted: 0 });
    expect(dailyClient.getDailyMatches).not.toHaveBeenCalled();
    expect(seasonClient.getSeasonMatches).not.toHaveBeenCalled();
    release();
    await expect(holding).resolves.toEqual({ acquired: true, value: 'released' });
  });
});
