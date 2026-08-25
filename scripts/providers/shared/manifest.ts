import { mkdir, appendFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { API_FOOTBALL_COMPETITION_REGISTRY } from '../../../packages/config/src/api-football-source-registry.js';
import type {
  ProviderId,
  ProviderCaptureManifestEntry,
  ProviderSourceBindingPolicy
} from '../../../packages/shared/src/contracts/provider-ingestion-contracts.js';
import { validateProviderCaptureManifestEntry } from '../../../packages/shared/src/contracts/provider-ingestion-contracts.js';

const API_FOOTBALL_SOURCE_BINDING_POLICY: ProviderSourceBindingPolicy = {
  resolveSourceBinding(provider, allowlistEntryId) {
    if (provider !== 'api-football') {
      return undefined;
    }

    const source = API_FOOTBALL_COMPETITION_REGISTRY.find((entry) => entry.entryId === allowlistEntryId);
    if (!source) {
      return undefined;
    }

    return {
      allowlistEntryId: source.entryId,
      endpointKey: source.entryId,
      urlPath: `/fixtures`,
      source: {
        leagueId: String(source.providerLeagueId),
        competitionId: source.competitionId
      }
    };
  }
};

/**
 * Append a manifest entry for a provider capture run to:
 *   <root>/providers/<provider>/manifests/capture-manifest.jsonl
 *
 * Each line is a compact JSON object (no newlines inside the record).
 */
export async function appendProviderManifestEntry(
  root: string,
  provider: ProviderId,
  entry: ProviderCaptureManifestEntry
): Promise<void> {
  assertValidProviderManifestEntry(provider, entry);

  const dir = join(root, 'providers', provider, 'manifests');
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, 'capture-manifest.jsonl');
  await appendFile(filePath, JSON.stringify(entry) + '\n', 'utf8');
}

export async function readLatestProviderManifestEntry(
  root: string,
  provider: ProviderId,
  endpointKey: string
): Promise<ProviderCaptureManifestEntry | null> {
  const filePath = join(root, 'providers', provider, 'manifests', 'capture-manifest.jsonl');
  let content: string;

  try {
    content = await readFile(filePath, 'utf8');
  } catch (error) {
    if (isMissingPathError(error)) {
      return null;
    }
    throw error;
  }

  let latest: ProviderCaptureManifestEntry | null = null;
  let latestFetchedAt = Number.NEGATIVE_INFINITY;

  for (const line of content.split(/\r?\n/)) {
    if (line.trim() === '') {
      continue;
    }

    const entry = parseProviderManifestEntry(line);
    if (entry.provider !== provider) {
      throw providerManifestInvalid('Manifest provider does not match its evidence path');
    }
    if (entry.endpointKey !== endpointKey) {
      continue;
    }

    const fetchedAt = entry.fetchedAt === undefined ? Number.NEGATIVE_INFINITY : Date.parse(entry.fetchedAt);
    if (Number.isNaN(fetchedAt)) {
      throw providerManifestInvalid('Manifest fetchedAt is not a valid timestamp');
    }
    if (latest === null || fetchedAt > latestFetchedAt) {
      latest = entry;
      latestFetchedAt = fetchedAt;
    }
  }

  return latest;
}

function assertValidProviderManifestEntry(
  provider: ProviderId,
  entry: ProviderCaptureManifestEntry
): void {
  if (entry.provider !== provider) {
    throw providerManifestInvalid('Manifest provider does not match its evidence path');
  }

  const validation = validateProviderCaptureManifestEntry(entry, API_FOOTBALL_SOURCE_BINDING_POLICY);
  if (!validation.ok) {
    throw providerManifestInvalid(validation.errors.join('; '));
  }
}

function parseProviderManifestEntry(line: string): ProviderCaptureManifestEntry {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    throw providerManifestInvalid('Manifest evidence is not valid JSON');
  }

  assertValidProviderManifestEntry((parsed as { provider?: ProviderId }).provider ?? 'manual-snapshot', parsed as ProviderCaptureManifestEntry);
  return parsed as ProviderCaptureManifestEntry;
}

function providerManifestInvalid(message: string): Error & { code: 'provider_manifest_invalid' } {
  return Object.assign(new Error(`provider_manifest_invalid: ${message}`), {
    code: 'provider_manifest_invalid' as const
  });
}

function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
