import { appendFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  appendProviderManifestEntry,
  readLatestProviderManifestEntry
} from './manifest.js';

const OPENFOOTBALL_ENDPOINT = 'openfootball-england-premier-league-2026-27';
const OPENFOOTBALL_URL_PATH = '/openfootball/england/master/2026-27/1-premierleague.txt';

function createOpenFootballManifest(fetchedAt: string, status: 'captured' | 'published') {
  return {
    runId: `run-${fetchedAt}`,
    allowlistEntryId: OPENFOOTBALL_ENDPOINT,
    provider: 'openfootball' as const,
    endpointKey: OPENFOOTBALL_ENDPOINT,
    urlPath: OPENFOOTBALL_URL_PATH,
    query: {},
    status,
    fetchedAt
  };
}

describe('appendProviderManifestEntry', () => {
  it('returns the newest matching OpenFootball manifest entry by fetchedAt', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-provider-'));
    await appendProviderManifestEntry(root, 'openfootball', createOpenFootballManifest(
      '2026-07-02T13:00:00.000Z',
      'published'
    ));
    await appendProviderManifestEntry(root, 'openfootball', createOpenFootballManifest(
      '2026-07-02T12:00:00.000Z',
      'captured'
    ));

    const manifest = await readLatestProviderManifestEntry(root, 'openfootball', OPENFOOTBALL_ENDPOINT);

    expect(manifest).toMatchObject({
      fetchedAt: '2026-07-02T13:00:00.000Z',
      status: 'published'
    });
  });

  it('rejects malformed JSONL instead of ignoring evidence corruption', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-provider-'));
    await appendProviderManifestEntry(root, 'openfootball', createOpenFootballManifest(
      '2026-07-02T12:00:00.000Z',
      'published'
    ));
    await appendFile(
      join(root, 'providers', 'openfootball', 'manifests', 'capture-manifest.jsonl'),
      '{ malformed json }\n',
      'utf8'
    );

    await expect(readLatestProviderManifestEntry(root, 'openfootball', OPENFOOTBALL_ENDPOINT))
      .rejects.toMatchObject({ code: 'provider_manifest_invalid' });
  });
});
