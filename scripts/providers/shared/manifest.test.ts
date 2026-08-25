import { appendFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  appendProviderManifestEntry,
  readLatestProviderManifestEntry
} from './manifest.js';

const TEST_ENDPOINT = 'api-football-eng-premier-league';
const TEST_URL_PATH = '/fixtures';

function createTestManifest(fetchedAt: string, status: 'captured' | 'published') {
  return {
    runId: `run-${fetchedAt}`,
    allowlistEntryId: TEST_ENDPOINT,
    provider: 'api-football' as const,
    endpointKey: TEST_ENDPOINT,
    urlPath: TEST_URL_PATH,
    query: {},
    status,
    fetchedAt
  };
}

describe('appendProviderManifestEntry', () => {
  it('returns the newest matching provider manifest entry by fetchedAt', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-provider-'));
    await appendProviderManifestEntry(root, 'api-football', createTestManifest(
      '2026-08-25T13:00:00.000Z',
      'published'
    ));
    await appendProviderManifestEntry(root, 'api-football', createTestManifest(
      '2026-08-25T12:00:00.000Z',
      'captured'
    ));

    const manifest = await readLatestProviderManifestEntry(root, 'api-football', TEST_ENDPOINT);

    expect(manifest).toMatchObject({
      fetchedAt: '2026-08-25T13:00:00.000Z',
      status: 'published'
    });
  });

  it('rejects malformed JSONL instead of ignoring evidence corruption', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-provider-'));
    await appendProviderManifestEntry(root, 'api-football', createTestManifest(
      '2026-08-25T12:00:00.000Z',
      'published'
    ));
    await appendFile(
      join(root, 'providers', 'api-football', 'manifests', 'capture-manifest.jsonl'),
      '{ malformed json }\n',
      'utf8'
    );

    await expect(readLatestProviderManifestEntry(root, 'api-football', TEST_ENDPOINT))
      .rejects.toMatchObject({ code: 'provider_manifest_invalid' });
  });
});
