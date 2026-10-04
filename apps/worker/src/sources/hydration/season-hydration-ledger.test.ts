import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SeasonHydrationLedger } from './season-hydration-ledger.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('season hydration checkpoint ledger', () => {
  it('stores provider + competition + season checkpoints with ETag/cursor outside legacy SportScore state', async () => {
    const dataRoot = await mkdtemp(path.join(os.tmpdir(), 'miraichi-season-ledger-'));
    roots.push(dataRoot);
    const ledger = new SeasonHydrationLedger({ dataRoot });
    await ledger.recordSuccess(
      'openfootball|eng-premier-league|2026-27',
      new Date('2026-08-28T00:00:00.000Z'),
      { etag: '"etag-1"', cursor: 'page-1' }
    );

    const state = await ledger.getState();
    expect(state.checkpoints['openfootball|eng-premier-league|2026-27']).toEqual({
      completedAt: '2026-08-28T00:00:00.000Z',
      etag: '"etag-1"',
      cursor: 'page-1'
    });
    await expect(readFile(path.join(
      dataRoot,
      'providers',
      'season-hydration',
      'state',
      'ledger.json'
    ), 'utf8')).resolves.toContain('openfootball|eng-premier-league|2026-27');
    await expect(readFile(path.join(
      dataRoot,
      'providers',
      'sportscore',
      'state',
      'hydration-ledger.json'
    ), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
