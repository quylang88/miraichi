import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  OPENFOOTBALL_SOURCE_REGISTRY,
  buildOpenFootballRawUrl,
  type OpenFootballCompetitionSource
} from '@miraichi/config';
import { readServingMatchStoreSnapshot } from '../../../api/src/repositories/serving-match-store.js';
import { appendProviderManifestEntry } from '../../../../scripts/providers/shared/manifest.js';
import { readLatestRawProviderPayload, writeRawProviderPayload } from '../../../../scripts/providers/shared/raw-cache.js';
import { OpenFootballFetchError } from '../sources/openfootball/openfootball-client.js';
import { parseFootballTxt } from '../sources/openfootball/football-txt-parser.js';
import {
  runOpenFootballIngestionJob,
  type OpenFootballIngestionJobOptions
} from './openfootball-ingestion-job.js';

const englandFixture = `= English Premier League 2026/27
# Source: openfootball/england master 2026-27/1-premierleague.txt

▪ Matchday 1
  Fri Aug 21 2026
    20:00  Arsenal FC              v Coventry City FC
  Sat Aug 22
    12:30  Hull City AFC           v Manchester United FC
    15:00  Ipswich Town FC         v Sunderland AFC          2-1 (1-0)
           Nottingham Forest FC    v Leeds United FC
`;

const worldCupFixture = `= World Cup 2026      # in Canada, USA, and Mexico
# Source: openfootball/worldcup master 2026--canada-usa-mexico/cup.txt

Group A | Mexico  South Africa  South Korea  Czech Republic

▪ Group A
  Thu June 11
    13:00 UTC-6  Mexico       2-0 (1-0)  South Africa     @ Mexico City
                   (Julián Quiñones 9' Raúl Jiménez 67')
    20:00 UTC-6  South Korea  2-1 (0-0)  Czech Republic  @ Guadalajara (Zapopan)
                   (Hwang In-Beom 67' Oh Hyeon-Gyu 80';
                    Ladislav Krejcí 59')
`;

function sources(): OpenFootballCompetitionSource[] {
  return OPENFOOTBALL_SOURCE_REGISTRY.map((source) => ({
    ...source,
    minimumExpectedMatches: source.competitionType === 'club' ? 4 : 2
  }));
}

function changed(source: OpenFootballCompetitionSource, text: string, fetchedAt: string) {
  return {
    status: 'changed' as const,
    fetchedAt,
    urlPath: new URL(buildOpenFootballRawUrl(source)).pathname,
    text,
    etag: `etag-${source.entryId}`,
    lastModified: 'Fri, 01 Aug 2026 00:00:00 GMT',
    contentType: 'text/plain; charset=utf-8',
    byteCount: Buffer.byteLength(text, 'utf8')
  };
}

function notModified(source: OpenFootballCompetitionSource, fetchedAt: string) {
  return {
    status: 'not_modified' as const,
    fetchedAt,
    urlPath: new URL(buildOpenFootballRawUrl(source)).pathname,
    etag: `etag-${source.entryId}`,
    lastModified: 'Fri, 01 Aug 2026 00:00:00 GMT'
  };
}

function sourceText(source: OpenFootballCompetitionSource): string {
  return source.competitionType === 'club' ? englandFixture : worldCupFixture;
}

async function optionsFor(
  fetchSource: Exclude<NonNullable<OpenFootballIngestionJobOptions['dependencies']>['fetchSource'], undefined>,
  now: () => Date,
  dependencies: OpenFootballIngestionJobOptions['dependencies'] = {}
): Promise<OpenFootballIngestionJobOptions> {
  return {
    dataRoot: await mkdtemp(join(tmpdir(), 'miraichi-openfootball-job-')),
    sources: sources(),
    now,
    dependencies: { ...dependencies, fetchSource }
  };
}

async function manifestEntries(dataRoot: string): Promise<Array<{ status: string; runId?: string; errorCode?: string; endpointKey?: string }>> {
  const text = await readFile(join(dataRoot, 'providers', 'openfootball', 'manifests', 'capture-manifest.jsonl'), 'utf8');
  return text.trim().split(/\r?\n/).map((line) => JSON.parse(line) as { status: string; runId?: string; errorCode?: string; endpointKey?: string });
}

function notModifiedManifest(source: OpenFootballCompetitionSource, fetchedAt: string) {
  return {
    runId: `prior-${source.entryId}-${fetchedAt}`,
    allowlistEntryId: source.entryId,
    provider: 'openfootball' as const,
    endpointKey: source.entryId,
    urlPath: new URL(buildOpenFootballRawUrl(source)).pathname,
    query: {},
    status: 'not_modified' as const,
    fetchedAt
  };
}

describe('runOpenFootballIngestionJob', () => {
  it('publishes only the exact fully validated warehouse run after archiving each changed source', async () => {
    const now = () => new Date('2026-08-01T00:00:00.000Z');
    let rawWasArchived = false;
    let inFlightFetches = 0;
    let maximumInFlightFetches = 0;
    let publishedAfterServing = false;
    const options = await optionsFor(async ({ source }) => {
      inFlightFetches += 1;
      maximumInFlightFetches = Math.max(maximumInFlightFetches, inFlightFetches);
      await Promise.resolve();
      inFlightFetches -= 1;
      return changed(source, sourceText(source), now().toISOString());
    }, now, {
      parseText(text) {
        expect(rawWasArchived).toBe(true);
        return parseFootballTxt(text);
      },
      async writeRawPayload(root, envelope) {
        const archivedPath = await writeRawProviderPayload(root, envelope);
        rawWasArchived = true;
        return archivedPath;
      },
      async appendManifest(root, provider, entry) {
        if (entry.status === 'published') {
          await expect(readFile(join(root, 'serving', 'manifest.json'), 'utf8')).resolves.toContain(`\"warehouseRunId\": \"${entry.runId}\"`);
          publishedAfterServing = true;
        }
        await appendProviderManifestEntry(root, provider, entry);
      }
    });

    const result = await runOpenFootballIngestionJob(options);
    const snapshot = await readServingMatchStoreSnapshot(join(options.dataRoot, 'serving'));
    const manifest = JSON.parse(await readFile(join(options.dataRoot, 'serving', 'manifest.json'), 'utf8')) as { warehouseRunId?: string };

    expect(result).toMatchObject({
      status: 'published',
      changedSourceCount: 2,
      notModifiedSourceCount: 0,
      publishedMatchCount: 6
    });
    expect(snapshot).toMatchObject({
      sources: expect.arrayContaining([expect.objectContaining({ sourceId: 'openfootball' })])
    });
    expect(manifest.warehouseRunId).toBe(result.status === 'published' ? result.runId : undefined);
    expect(maximumInFlightFetches).toBe(1);
    expect(publishedAfterServing).toBe(true);
    await expect(readLatestRawProviderPayload(options.dataRoot, 'openfootball', options.sources[0]!.entryId)).resolves.not.toBeNull();
  });

  it('reparses the archived raw payload on 304 and leaves the serving version unchanged when every source is unchanged', async () => {
    let current = new Date('2026-08-01T00:00:00.000Z');
    let phase: 'changed' | 'not_modified' = 'changed';
    let parseCount = 0;
    const options = await optionsFor(async ({ source }) => (
      phase === 'changed'
        ? changed(source, sourceText(source), current.toISOString())
        : notModified(source, current.toISOString())
    ), () => current, {
      parseText(text) {
        parseCount += 1;
        return parseFootballTxt(text);
      }
    });

    const first = await runOpenFootballIngestionJob(options);
    const manifestBefore = await readFile(join(options.dataRoot, 'serving', 'manifest.json'), 'utf8');
    phase = 'not_modified';
    current = new Date('2026-08-01T06:01:00.000Z');
    const second = await runOpenFootballIngestionJob(options);

    expect(first.status).toBe('published');
    expect(second).toMatchObject({ status: 'not_modified', changedSourceCount: 0, notModifiedSourceCount: 2 });
    expect(parseCount).toBe(4);
    expect(await readFile(join(options.dataRoot, 'serving', 'manifest.json'), 'utf8')).toBe(manifestBefore);
  });

  it('fails a 304 response when no prior raw payload is available to reparse', async () => {
    const now = () => new Date('2026-08-01T00:00:00.000Z');
    const options = await optionsFor(async ({ source }) => notModified(source, now().toISOString()), now);

    const result = await runOpenFootballIngestionJob(options);

    expect(result).toMatchObject({ status: 'failed', errorCodes: ['missing_last_raw_payload'] });
    expect((await manifestEntries(options.dataRoot)).some((entry) => entry.status === 'failed' && entry.errorCode === 'missing_last_raw_payload')).toBe(true);
  });

  it('skips a not-due registry without issuing HTTP requests', async () => {
    let current = new Date('2026-08-01T00:00:00.000Z');
    let calls = 0;
    const options = await optionsFor(async ({ source }) => {
      calls += 1;
      return changed(source, sourceText(source), current.toISOString());
    }, () => current);

    await runOpenFootballIngestionJob(options);
    current = new Date('2026-08-01T00:01:00.000Z');
    const result = await runOpenFootballIngestionJob(options);

    expect(result).toMatchObject({ status: 'skipped', changedSourceCount: 0, notModifiedSourceCount: 0 });
    expect(calls).toBe(2);
  });

  it('records unavailable evidence for a 404 source failure', async () => {
    const now = () => new Date('2026-08-01T00:00:00.000Z');
    const options = await optionsFor(async () => {
      throw new OpenFootballFetchError({
        code: 'source_unavailable',
        message: '404',
        httpStatus: 404,
        attemptCount: 1
      });
    }, now);

    const result = await runOpenFootballIngestionJob(options);

    expect(result).toMatchObject({ status: 'failed', errorCodes: ['source_unavailable'] });
    expect((await manifestEntries(options.dataRoot)).some((entry) => entry.status === 'unavailable' && entry.errorCode === 'source_unavailable')).toBe(true);
  });

  it('records invalid evidence for parse failures without publishing any source', async () => {
    const now = () => new Date('2026-08-01T00:00:00.000Z');
    const options = await optionsFor(async ({ source }) => changed(source, '= malformed\n', now().toISOString()), now);

    const result = await runOpenFootballIngestionJob(options);

    expect(result.status).toBe('failed');
    expect((await manifestEntries(options.dataRoot)).some((entry) => entry.status === 'invalid')).toBe(true);
    await expect(readFile(join(options.dataRoot, 'serving', 'manifest.json'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('blocks a successful source from publication when another source fails', async () => {
    const now = () => new Date('2026-08-01T00:00:00.000Z');
    const options = await optionsFor(async ({ source }) => {
      if (source.competitionType === 'national-team') {
        throw new OpenFootballFetchError({ code: 'source_unavailable', message: '404', httpStatus: 404, attemptCount: 1 });
      }
      return changed(source, englandFixture, now().toISOString());
    }, now);

    const result = await runOpenFootballIngestionJob(options);

    expect(result.status).toBe('failed');
    expect((await manifestEntries(options.dataRoot)).some((entry) => entry.status === 'published')).toBe(false);
    await expect(readFile(join(options.dataRoot, 'serving', 'manifest.json'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('preserves the prior serving manifest when a later changed payload is invalid', async () => {
    let current = new Date('2026-08-01T00:00:00.000Z');
    let invalidUpdate = false;
    const options = await optionsFor(async ({ source }) => changed(
      source,
      invalidUpdate ? '= malformed\n' : sourceText(source),
      current.toISOString()
    ), () => current);

    const published = await runOpenFootballIngestionJob(options);
    const manifestBefore = await readFile(join(options.dataRoot, 'serving', 'manifest.json'), 'utf8');
    invalidUpdate = true;
    current = new Date('2026-08-01T06:01:00.000Z');
    const failed = await runOpenFootballIngestionJob(options);

    expect(published.status).toBe('published');
    expect(failed.status).toBe('failed');
    expect(await readFile(join(options.dataRoot, 'serving', 'manifest.json'), 'utf8')).toBe(manifestBefore);
    expect((await manifestEntries(options.dataRoot)).some((entry) => entry.status === 'invalid' && entry.runId === failed.runId)).toBe(true);
    await expect(readLatestRawProviderPayload(options.dataRoot, 'openfootball', options.sources[0]!.entryId))
      .resolves.toMatchObject({ payload: '= malformed\n' });
  });

  it('rejects duplicate canonical match IDs at publication and preserves the last-good serving manifest', async () => {
    let current = new Date('2026-08-01T00:00:00.000Z');
    let duplicateCanonicalMatch = false;
    const options = await optionsFor(async ({ source }) => (
      changed(source, sourceText(source), current.toISOString())
    ), () => current, {
      parseText(text) {
        const parsed = parseFootballTxt(text);
        if (duplicateCanonicalMatch && text.includes('English Premier League')) {
          parsed.matches.push({ ...parsed.matches[0]!, lineNumber: 999 });
        }
        return parsed;
      }
    });

    const first = await runOpenFootballIngestionJob(options);
    expect(first.status).toBe('published');
    const manifestBefore = await readFile(join(options.dataRoot, 'serving', 'manifest.json'), 'utf8');
    const snapshotBefore = await readServingMatchStoreSnapshot(join(options.dataRoot, 'serving'));

    duplicateCanonicalMatch = true;
    current = new Date('2026-08-01T06:01:00.000Z');
    const failed = await runOpenFootballIngestionJob(options);

    expect(failed).toMatchObject({ status: 'failed', errorCodes: ['publication_validation_failed'] });
    expect(await readFile(join(options.dataRoot, 'serving', 'manifest.json'), 'utf8')).toBe(manifestBefore);
    await expect(readServingMatchStoreSnapshot(join(options.dataRoot, 'serving'))).resolves.toEqual(snapshotBefore);
  });

  it('invalidates partial published evidence, restores the prior pointer, and retries every source', async () => {
    let current = new Date('2026-08-01T00:00:00.000Z');
    let rejectPublishedEvidence = false;
    let fetchCalls = 0;
    const options = await optionsFor(async ({ source }) => changed(source, sourceText(source), current.toISOString()), () => current, {
      async appendManifest(root, provider, entry) {
        if (rejectPublishedEvidence && entry.status === 'published' && entry.endpointKey === sources()[1]!.entryId) {
          throw new Error('published manifest unavailable');
        }
        await appendProviderManifestEntry(root, provider, entry);
      }
    });
    options.dependencies!.fetchSource = async ({ source }) => {
      fetchCalls += 1;
      return changed(source, sourceText(source), current.toISOString());
    };

    const first = await runOpenFootballIngestionJob(options);
    const manifestBefore = await readFile(join(options.dataRoot, 'serving', 'manifest.json'), 'utf8');
    current = new Date('2026-08-01T06:01:00.000Z');
    rejectPublishedEvidence = true;
    const second = await runOpenFootballIngestionJob(options);
    const manifestAfterSecond = await readFile(join(options.dataRoot, 'serving', 'manifest.json'), 'utf8');
    const secondEntries = (await manifestEntries(options.dataRoot)).filter((entry) => entry.runId === second.runId);
    current = new Date('2026-08-01T06:02:00.000Z');
    rejectPublishedEvidence = false;
    fetchCalls = 0;
    const third = await runOpenFootballIngestionJob(options);

    expect(first.status).toBe('published');
    expect(second).toMatchObject({ status: 'failed', errorCodes: ['publication_failed'] });
    expect(manifestAfterSecond).toBe(manifestBefore);
    expect(secondEntries.filter((entry) => entry.status === 'failed').map((entry) => entry.endpointKey)).toEqual(
      options.sources.map((source) => source.entryId)
    );
    expect(third.status).toBe('published');
    expect(fetchCalls).toBe(2);
  });

  it('removes a newly-created serving pointer after partial publication and retries every source', async () => {
    let current = new Date('2026-08-01T00:00:00.000Z');
    let rejectPublishedEvidence = true;
    let fetchCalls = 0;
    const options = await optionsFor(async ({ source }) => {
      fetchCalls += 1;
      return changed(source, sourceText(source), current.toISOString());
    }, () => current, {
      async appendManifest(root, provider, entry) {
        if (rejectPublishedEvidence && entry.status === 'published' && entry.endpointKey === sources()[1]!.entryId) {
          throw new Error('published manifest unavailable');
        }
        await appendProviderManifestEntry(root, provider, entry);
      }
    });

    const failed = await runOpenFootballIngestionJob(options);
    await expect(readFile(join(options.dataRoot, 'serving', 'manifest.json'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    current = new Date('2026-08-01T00:01:00.000Z');
    rejectPublishedEvidence = false;
    fetchCalls = 0;
    const retried = await runOpenFootballIngestionJob(options);

    expect(failed).toMatchObject({ status: 'failed', errorCodes: ['publication_failed'] });
    expect(retried.status).toBe('published');
    expect(fetchCalls).toBe(2);
  });

  it('falls back to a verified rollback when the injected rollback operation fails', async () => {
    let current = new Date('2026-08-01T00:00:00.000Z');
    let rejectPublishedEvidence = false;
    let rollbackCalls = 0;
    const options = await optionsFor(async ({ source }) => changed(source, sourceText(source), current.toISOString()), () => current, {
      async appendManifest(root, provider, entry) {
        if (rejectPublishedEvidence && entry.status === 'published' && entry.endpointKey === sources()[1]!.entryId) {
          throw new Error('published manifest unavailable');
        }
        await appendProviderManifestEntry(root, provider, entry);
      },
      async restoreServingManifest() {
        rollbackCalls += 1;
        throw new Error('injected rollback failed');
      }
    });

    await runOpenFootballIngestionJob(options);
    const manifestBefore = await readFile(join(options.dataRoot, 'serving', 'manifest.json'), 'utf8');
    current = new Date('2026-08-01T06:01:00.000Z');
    rejectPublishedEvidence = true;
    const failed = await runOpenFootballIngestionJob(options);

    expect(failed).toMatchObject({ status: 'failed', errorCodes: ['publication_failed'] });
    expect(rollbackCalls).toBe(1);
    expect(await readFile(join(options.dataRoot, 'serving', 'manifest.json'), 'utf8')).toBe(manifestBefore);
  });

  it('returns typed failed evidence instead of leaking a corrupt raw-cache exception', async () => {
    let current = new Date('2026-08-01T00:00:00.000Z');
    const options = await optionsFor(async ({ source }) => changed(source, sourceText(source), current.toISOString()), () => current);
    await runOpenFootballIngestionJob(options);
    const rawRoot = join(options.dataRoot, 'providers', 'openfootball', 'raw', options.sources[0]!.entryId, '2026-08-01');
    const rawFile = (await readdir(rawRoot)).find((name) => name.endsWith('.json'))!;
    await writeFile(join(rawRoot, rawFile), '{ corrupt raw evidence }\n', 'utf8');
    current = new Date('2026-08-01T06:01:00.000Z');

    const result = await runOpenFootballIngestionJob(options);

    expect(result).toMatchObject({ status: 'failed', errorCodes: ['evidence_lookup_failed'] });
    expect((await manifestEntries(options.dataRoot)).some((entry) => entry.status === 'failed' && entry.errorCode === 'evidence_lookup_failed')).toBe(true);
  });

  it('returns typed failed evidence when the publication validator throws', async () => {
    const now = () => new Date('2026-08-01T00:00:00.000Z');
    const options = await optionsFor(async ({ source }) => changed(source, sourceText(source), now().toISOString()), now, {
      validatePublication() {
        throw new Error('validator exploded');
      }
    });

    const result = await runOpenFootballIngestionJob(options);

    expect(result).toMatchObject({ status: 'failed', errorCodes: ['publication_validation_error'] });
    expect((await manifestEntries(options.dataRoot)).some((entry) => entry.status === 'failed' && entry.errorCode === 'publication_validation_error')).toBe(true);
  });

  it('records a registry failure against entries whose allowlist identity is still usable', async () => {
    const now = () => new Date('2026-08-01T00:00:00.000Z');
    const dataRoot = await mkdtemp(join(tmpdir(), 'miraichi-openfootball-job-'));
    const source = { ...sources()[0]!, sourceTimezone: 'Not/A-Timezone' };

    const result = await runOpenFootballIngestionJob({
      dataRoot,
      sources: [source],
      now,
      dependencies: { fetchSource: async ({ source: fetchSource }) => changed(fetchSource, englandFixture, now().toISOString()) }
    });

    expect(result).toMatchObject({ status: 'failed', errorCodes: ['invalid_registry'] });
    expect((await manifestEntries(dataRoot)).some((entry) => entry.status === 'failed' && entry.errorCode === 'invalid_registry')).toBe(true);
  });

  it('does not leak malformed runtime source entries and records invalid registry evidence for usable identities', async () => {
    const now = () => new Date('2026-08-01T00:00:00.000Z');
    const dataRoot = await mkdtemp(join(tmpdir(), 'miraichi-openfootball-job-'));
    const identifiable = { ...sources()[0]! } as Record<string, unknown>;
    delete identifiable.sourceTimezone;

    const result = await runOpenFootballIngestionJob({
      dataRoot,
      sources: [null, {}, identifiable] as unknown as readonly OpenFootballCompetitionSource[],
      now
    });

    expect(result).toMatchObject({ status: 'failed', errorCodes: ['invalid_registry'] });
    expect((await manifestEntries(dataRoot)).filter((entry) => entry.errorCode === 'invalid_registry')).toEqual([
      expect.objectContaining({ endpointKey: sources()[0]!.entryId, status: 'failed' })
    ]);
  });

  it('classifies raw evidence write failures separately from fetch failures', async () => {
    const now = () => new Date('2026-08-01T00:00:00.000Z');
    const options = await optionsFor(async ({ source }) => changed(source, sourceText(source), now().toISOString()), now, {
      async writeRawPayload() {
        throw new Error('raw evidence disk unavailable');
      }
    });

    const result = await runOpenFootballIngestionJob(options);

    expect(result).toMatchObject({ status: 'failed', errorCodes: ['raw_evidence_write_failed'] });
    expect((await manifestEntries(options.dataRoot)).some((entry) => (
      entry.status === 'failed' && entry.errorCode === 'raw_evidence_write_failed'
    ))).toBe(true);
  });

  it('uses the injected latest-manifest reader as the due boundary', async () => {
    const now = () => new Date('2026-08-01T01:00:00.000Z');
    let fetchCalls = 0;
    const options = await optionsFor(async ({ source }) => {
      fetchCalls += 1;
      return changed(source, sourceText(source), now().toISOString());
    }, now, {
      async readLatestManifest(_root, _provider, endpointKey) {
        const source = sources().find((entry) => entry.entryId === endpointKey)!;
        return notModifiedManifest(source, '2026-08-01T00:30:00+02:00');
      }
    });

    const result = await runOpenFootballIngestionJob(options);

    expect(result.status).toBe('skipped');
    expect(fetchCalls).toBe(0);
  });

  it('keeps an injected manifest history authoritative over newer disk evidence', async () => {
    const now = () => new Date('2026-08-01T07:00:00.000Z');
    let fetchCalls = 0;
    const options = await optionsFor(async ({ source }) => {
      fetchCalls += 1;
      return changed(source, sourceText(source), now().toISOString());
    }, now, {
      async readManifestHistory() {
        return sources().map((source) => notModifiedManifest(source, '2026-08-01T00:00:00.000Z'));
      }
    });
    for (const source of options.sources) {
      await appendProviderManifestEntry(options.dataRoot, 'openfootball', notModifiedManifest(source, '2026-08-01T06:30:00.000Z'));
    }

    const result = await runOpenFootballIngestionJob(options);

    expect(result.status).toBe('published');
    expect(fetchCalls).toBe(2);
  });

  it('keeps the legacy injected latest-manifest reader authoritative over newer disk evidence', async () => {
    const now = () => new Date('2026-08-01T07:00:00.000Z');
    let fetchCalls = 0;
    const options = await optionsFor(async ({ source }) => {
      fetchCalls += 1;
      return changed(source, sourceText(source), now().toISOString());
    }, now, {
      async readLatestManifest(_root, _provider, endpointKey) {
        const source = sources().find((entry) => entry.entryId === endpointKey)!;
        return notModifiedManifest(source, '2026-08-01T00:00:00.000Z');
      }
    });
    for (const source of options.sources) {
      await appendProviderManifestEntry(options.dataRoot, 'openfootball', notModifiedManifest(source, '2026-08-01T06:30:00.000Z'));
    }

    const result = await runOpenFootballIngestionJob(options);

    expect(result.status).toBe('published');
    expect(fetchCalls).toBe(2);
  });

  it('invalidates a partial publication using terminal failure from the same injected history', async () => {
    const now = () => new Date('2026-08-01T06:02:00.000Z');
    let fetchCalls = 0;
    const sourceEntries = sources();
    const failedRunId = 'injected-partial-publication';
    const options = await optionsFor(async ({ source }) => {
      fetchCalls += 1;
      return changed(source, sourceText(source), now().toISOString());
    }, now, {
      async readManifestHistory() {
        return [
          ...sourceEntries.map((source) => notModifiedManifest(source, '2026-08-01T00:00:00.000Z')),
          { ...notModifiedManifest(sourceEntries[0]!, '2026-08-01T06:01:00.000Z'), runId: failedRunId, status: 'published' as const },
          {
            ...notModifiedManifest(sourceEntries[1]!, '2026-08-01T06:01:00.000Z'),
            runId: failedRunId,
            status: 'failed' as const,
            errorCode: 'publication_failed',
            errorMessage: 'source evidence append failed'
          }
        ];
      }
    });
    for (const source of options.sources) {
      await appendProviderManifestEntry(options.dataRoot, 'openfootball', notModifiedManifest(source, '2026-08-01T06:01:00.000Z'));
    }

    const result = await runOpenFootballIngestionJob(options);

    expect(result.status).toBe('published');
    expect(fetchCalls).toBe(2);
  });

  it('selects the chronologically latest ISO-offset manifest timestamp when determining due work', async () => {
    const now = () => new Date('2026-08-01T05:30:00.000Z');
    let fetchCalls = 0;
    const options = await optionsFor(async ({ source }) => {
      fetchCalls += 1;
      return changed(source, sourceText(source), now().toISOString());
    }, now);
    for (const source of options.sources) {
      await appendProviderManifestEntry(options.dataRoot, 'openfootball', notModifiedManifest(source, '2026-08-01T01:00:00+02:00'));
      await appendProviderManifestEntry(options.dataRoot, 'openfootball', notModifiedManifest(source, '2026-08-01T00:30:00Z'));
    }

    const result = await runOpenFootballIngestionJob(options);

    expect(result.status).toBe('skipped');
    expect(fetchCalls).toBe(0);
  });

  it('returns a failed result when appending pending evidence fails', async () => {
    const now = () => new Date('2026-08-01T00:00:00.000Z');
    const options = await optionsFor(async ({ source }) => changed(source, sourceText(source), now().toISOString()), now, {
      async appendManifest(_root, _provider, entry) {
        if (entry.status === 'pending') throw new Error('manifest offline');
        await appendProviderManifestEntry(_root, _provider, entry);
      }
    });

    await expect(runOpenFootballIngestionJob(options)).resolves.toMatchObject({
      status: 'failed',
      errorCodes: ['manifest_append_failed']
    });
  });
});
