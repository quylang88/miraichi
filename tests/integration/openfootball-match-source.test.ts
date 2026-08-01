import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  OPENFOOTBALL_SOURCE_REGISTRY,
  buildOpenFootballRawUrl,
  type OpenFootballCompetitionSource
} from '../../packages/config/src/index.js';
import { describe, expect, it } from 'vitest';
import { readServingMatchStoreSnapshot } from '../../apps/api/src/repositories/serving-match-store.js';
import { runOpenFootballIngestionJob } from '../../apps/worker/src/jobs/openfootball-ingestion-job.js';
import { adaptOpenFootballMatches } from '../../apps/worker/src/sources/openfootball/openfootball-adapter.js';
import { parseFootballTxt } from '../../apps/worker/src/sources/openfootball/football-txt-parser.js';
import { readLatestRawProviderPayload } from '../../scripts/providers/shared/raw-cache.js';

const fixtureRoot = join(
  process.cwd(),
  'apps',
  'worker',
  'src',
  'sources',
  'openfootball',
  'fixtures'
);

function integrationSources(): OpenFootballCompetitionSource[] {
  return OPENFOOTBALL_SOURCE_REGISTRY.map((source) => ({
    ...source,
    minimumExpectedMatches: source.competitionType === 'club' ? 4 : 2
  }));
}

function response(text: string): Response {
  return new Response(text, {
    status: 200,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      etag: `"${Buffer.byteLength(text, 'utf8')}"`
    }
  });
}

describe('OpenFootball match source raw-to-serving integration', () => {
  it('publishes club and national-team fixtures while preserving the last good version on malformed source data', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'miraichi-openfootball-integration-'));
    const servingRoot = join(dataRoot, 'serving');
    const sources = integrationSources();
    const clubSource = sources.find((source) => source.competitionType === 'club')!;
    const nationalSource = sources.find((source) => source.competitionType === 'national-team')!;
    const [clubFixture, nationalFixture] = await Promise.all([
      readFile(join(fixtureRoot, 'england-premier-league-level1.txt'), 'utf8'),
      readFile(join(fixtureRoot, 'world-cup-level1.txt'), 'utf8')
    ]);
    const malformedClubFixture = clubFixture.replace(
      '20:00  Arsenal FC              v Coventry City FC',
      '20:00  Arsenal FC'
    );
    let currentTime = new Date('2026-08-01T00:00:00.000Z');
    let malformedClubResponse = false;
    const fetchFn: typeof fetch = async (input) => {
      const request = input instanceof Request ? input : new Request(input);
      const source = sources.find((entry) => buildOpenFootballRawUrl(entry) === request.url);
      if (source === undefined) {
        throw new Error(`Unexpected OpenFootball integration URL: ${request.url}`);
      }
      if (source.entryId === clubSource.entryId) {
        return response(malformedClubResponse ? malformedClubFixture : clubFixture);
      }
      return response(nationalFixture);
    };

    try {
      const testOptions = {
        dataRoot,
        sources,
        now: () => currentTime,
        dependencies: {
          fetchClientDependencies: {
            fetchFn,
            sleep: async () => undefined
          }
        }
      };

      const first = await runOpenFootballIngestionJob(testOptions);
      expect(first).toMatchObject({
        status: 'published',
        changedSourceCount: 2,
        notModifiedSourceCount: 0,
        publishedMatchCount: 6
      });

      const snapshot = await readServingMatchStoreSnapshot(servingRoot);
      expect(new Set(snapshot.matches.map((match) => match.competition.type))).toEqual(
        new Set(['club', 'national-team'])
      );
      expect(snapshot.matches.every((match) => match.status !== ('in_play' as never))).toBe(true);
      expect(snapshot.matches.every((match) => !('odds' in match))).toBe(true);
      expect(snapshot.matches.every((match) => match.sourceRefs[0]?.sourceId === 'openfootball')).toBe(true);
      expect(snapshot.matches).toContainEqual(expect.objectContaining({
        competition: expect.objectContaining({ id: nationalSource.competitionId }),
        homeTeam: expect.objectContaining({ name: 'Mexico' }),
        venue: 'Mexico City'
      }));

      const [archivedClub, archivedNational] = await Promise.all([
        readLatestRawProviderPayload(dataRoot, 'openfootball', clubSource.entryId),
        readLatestRawProviderPayload(dataRoot, 'openfootball', nationalSource.entryId)
      ]);
      expect(archivedClub?.payload).toBe(clubFixture);
      expect(archivedNational?.payload).toBe(nationalFixture);

      const servingManifestPath = join(servingRoot, 'manifest.json');
      const firstServingManifest = JSON.parse(await readFile(servingManifestPath, 'utf8')) as {
        currentVersion: string;
      };

      currentTime = new Date(currentTime.getTime() + 361 * 60_000);
      malformedClubResponse = true;
      const failed = await runOpenFootballIngestionJob(testOptions);

      expect(failed.status).toBe('failed');
      const failedServingManifest = JSON.parse(await readFile(servingManifestPath, 'utf8')) as {
        currentVersion: string;
      };
      expect(failedServingManifest.currentVersion).toBe(firstServingManifest.currentVersion);
      await expect(readServingMatchStoreSnapshot(servingRoot)).resolves.toEqual(snapshot);

      const failedRaw = await readLatestRawProviderPayload(dataRoot, 'openfootball', clubSource.entryId);
      expect(failedRaw?.payload).toBe(malformedClubFixture);
      const manifestEntries = (await readFile(
        join(dataRoot, 'providers', 'openfootball', 'manifests', 'capture-manifest.jsonl'),
        'utf8'
      ))
        .trim()
        .split(/\r?\n/u)
        .map((line) => JSON.parse(line) as {
          runId?: string;
          endpointKey: string;
          status: string;
          errorCode?: string;
        });
      expect(manifestEntries).toContainEqual(expect.objectContaining({
        runId: failed.runId,
        endpointKey: clubSource.entryId,
        status: 'invalid',
        errorCode: 'unrecognized_line'
      }));

      const originalClubMatch = snapshot.matches.find((match) => (
        match.competition.id === clubSource.competitionId && match.homeTeam.name === 'Arsenal'
      ));
      const kickoffOnlyUpdate = clubFixture.replace('20:00  Arsenal FC', '20:30  Arsenal FC');
      const parsedKickoffOnlyUpdate = parseFootballTxt(kickoffOnlyUpdate);
      expect(parsedKickoffOnlyUpdate.issues).toEqual([]);
      const updatedClubMatch = adaptOpenFootballMatches({
        source: clubSource,
        parsedMatches: parsedKickoffOnlyUpdate.matches,
        observedAt: currentTime.toISOString()
      }).matches.find((match) => match.homeTeamId === originalClubMatch?.homeTeam.id);
      expect(updatedClubMatch?.kickoffUtc).not.toBe(originalClubMatch?.kickoffUtc);
      expect(updatedClubMatch?.matchId).toBe(originalClubMatch?.id);
    } finally {
      await rm(dataRoot, { recursive: true, force: true });
    }
  });
});
