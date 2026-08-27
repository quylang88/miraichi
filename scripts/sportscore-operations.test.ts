import { mkdir, mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SPORTSCORE_COMPETITION_REGISTRY } from '../packages/config/src/index.js';
import { readServingMatchStoreSnapshot } from '../apps/api/src/repositories/serving-match-store.js';
import { runSportScorePublicationJob } from '../apps/worker/src/jobs/sportscore-publication-job.js';
import { SportScoreSourceLedger } from '../apps/worker/src/sources/sportscore/sportscore-source-ledger.js';
import {
  SPORTSCORE_ACTIVE_ROOT_CONFIRMATION,
  bootstrapSportScoreActiveRoot,
  inspectSportScoreRuntimeStatus,
  inspectSportScoreSourceReview,
  prepareSportScoreSmokeRoot
} from './sportscore-operations.js';

const roots: string[] = [];

async function makeRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), prefix));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('SportScore explicit local operations', () => {
  it('reports the reviewed contract and unresolved terms scope without authorizing network use', async () => {
    const review = await inspectSportScoreSourceReview();
    expect(review).toMatchObject({
      realNetworkAuthorized: false,
      termsScope: 'blocked',
      termsUrl: 'https://sportscore.com/developers/terms/',
      openApiUrl: 'https://sportscore.com/developers/openapi.yaml'
    });
    expect(review.approvedFixtureSha256).toMatch(/^[a-f0-9]{64}$/u);
  });

  it('prepares only an isolated empty root and exposes sanitized empty status', async () => {
    const smokeRoot = await makeRoot('miraichi-sportscore-smoke-');
    const activeRoot = await makeRoot('miraichi-sportscore-active-');
    const prepared = await prepareSportScoreSmokeRoot({
      dataRoot: smokeRoot,
      activeDataRoot: activeRoot,
      now: () => new Date('2026-08-27T12:00:00.000Z')
    });
    const status = await inspectSportScoreRuntimeStatus({
      dataRoot: smokeRoot,
      now: () => new Date('2026-08-27T12:01:00.000Z')
    });

    expect(prepared).toMatchObject({
      dataRoot: path.resolve(smokeRoot),
      realNetworkAuthorized: false
    });
    expect(status).toMatchObject({
      serving: { freshness: 'missing', matchCount: 0 },
      ledger: { dailyCompleted: 0, dailyDeferred: 0, terminalPending: 0 }
    });
    await expect(prepareSportScoreSmokeRoot({
      dataRoot: activeRoot,
      activeDataRoot: activeRoot
    })).rejects.toThrow(/active data root/iu);
    await expect(prepareSportScoreSmokeRoot({
      dataRoot: path.join(activeRoot, 'nested-smoke'),
      activeDataRoot: activeRoot
    })).rejects.toThrow(/isolated/iu);
  });

  it('bootstraps one validated snapshot without overwriting an active serving root', async () => {
    const smokeRoot = await makeRoot('miraichi-sportscore-smoke-source-');
    const activeRoot = await makeRoot('miraichi-sportscore-active-target-');
    await prepareSportScoreSmokeRoot({
      dataRoot: smokeRoot,
      activeDataRoot: activeRoot,
      now: () => new Date('2026-08-27T12:00:00.000Z')
    });
    await runSportScorePublicationJob({
      dataRoot: smokeRoot,
      runId: 'isolated-smoke-approved-run',
      competitionEntry: SPORTSCORE_COMPETITION_REGISTRY[0]!,
      season: '2026-27',
      response: {
        sport: 'football',
        count: 1,
        matches: [{
          home: 'Bootstrap Home',
          away: 'Bootstrap Away',
          home_score: 2,
          away_score: 1,
          status: 'finished',
          status_text: 'FT',
          time: '2026-08-27T09:00:00Z',
          slug: 'bootstrap-home-vs-bootstrap-away'
        }]
      },
      observedAt: '2026-08-27T12:00:00.000Z'
    });
    await new SportScoreSourceLedger({ dataRoot: smokeRoot }).recordRotationCursor(
      1,
      new Date('2026-08-27T12:00:01.000Z')
    );

    await expect(bootstrapSportScoreActiveRoot({
      fromDataRoot: smokeRoot,
      toDataRoot: activeRoot,
      confirmation: 'wrong'
    })).rejects.toThrow(/confirmation/iu);

    const targetLedger = path.join(
      activeRoot,
      'providers',
      'sportscore',
      'state',
      'source-ledger.json'
    );
    await mkdir(path.dirname(targetLedger), { recursive: true });
    await writeFile(targetLedger, 'owner-data-must-survive', 'utf8');
    await expect(bootstrapSportScoreActiveRoot({
      fromDataRoot: smokeRoot,
      toDataRoot: activeRoot,
      confirmation: SPORTSCORE_ACTIVE_ROOT_CONFIRMATION
    })).rejects.toThrow(/destination already exists/iu);
    expect(await readFile(targetLedger, 'utf8')).toBe('owner-data-must-survive');
    await unlink(targetLedger);

    const result = await bootstrapSportScoreActiveRoot({
      fromDataRoot: smokeRoot,
      toDataRoot: activeRoot,
      confirmation: SPORTSCORE_ACTIVE_ROOT_CONFIRMATION
    });
    expect(result).toMatchObject({ matchCount: 1, sourceSnapshotId: 'isolated-smoke-approved-run' });
    expect((await readServingMatchStoreSnapshot(path.join(activeRoot, 'serving'))).matches)
      .toHaveLength(1);

    await expect(bootstrapSportScoreActiveRoot({
      fromDataRoot: smokeRoot,
      toDataRoot: activeRoot,
      confirmation: SPORTSCORE_ACTIVE_ROOT_CONFIRMATION
    })).rejects.toThrow(/already has a serving manifest/iu);
  });
});
