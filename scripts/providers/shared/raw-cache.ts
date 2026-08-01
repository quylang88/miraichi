import { createHash } from 'node:crypto';
import type { Dirent } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { OPENFOOTBALL_SOURCE_REGISTRY } from '../../../packages/config/src/openfootball-source-registry.js';
import {
  validateRawProviderPayloadEnvelope,
  type ProviderId,
  type ProviderSourceBindingPolicy,
  type RawProviderPayloadEnvelope
} from '../../../packages/shared/src/contracts/provider-ingestion-contracts.js';

const OPENFOOTBALL_SOURCE_BINDING_POLICY: ProviderSourceBindingPolicy = {
  resolveSourceBinding(provider, allowlistEntryId) {
    if (provider !== 'openfootball') {
      return undefined;
    }

    const source = OPENFOOTBALL_SOURCE_REGISTRY.find((entry) => entry.entryId === allowlistEntryId);
    if (!source) {
      return undefined;
    }

    return {
      allowlistEntryId: source.entryId,
      endpointKey: source.entryId,
      urlPath: `/openfootball/${source.repository}/${source.ref}/${source.filePath}`,
      source: {
        repository: source.repository,
        ref: source.ref,
        filePath: source.filePath
      }
    };
  }
};

/**
 * Produce a stable SHA-256 hex digest of a payload, with canonical key ordering
 * so that semantically identical objects hash the same regardless of insertion order.
 */
export function createPayloadHash(payload: unknown): string {
  const stable = JSON.stringify(sortedJson(payload));
  return createHash('sha256').update(stable, 'utf8').digest('hex');
}

export function createTextPayloadHash(text: string): string {
  return createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');
}

/**
 * Write a raw provider payload envelope to the filesystem under:
 *   <root>/providers/<provider>/raw/<endpointKey>/<YYYY-MM-DD>/<payloadHash>.json
 *
 * Returns the absolute path of the written file.
 */
export async function writeRawProviderPayload(
  root: string,
  envelope: RawProviderPayloadEnvelope
): Promise<string> {
  assertValidRawProviderPayload(envelope);

  const datePart = envelope.fetchedAt.slice(0, 10); // YYYY-MM-DD
  const dir = join(root, 'providers', envelope.provider, 'raw', envelope.endpointKey, datePart);
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, `${envelope.payloadHash}.json`);
  await writeFile(filePath, `${JSON.stringify(envelope, null, 2)}\n`, 'utf8');
  return filePath;
}

export async function readLatestRawProviderPayload(
  root: string,
  provider: ProviderId,
  endpointKey: string
): Promise<RawProviderPayloadEnvelope | null> {
  const endpointDir = join(root, 'providers', provider, 'raw', endpointKey);
  let dateDirectories: Dirent<string>[];

  try {
    dateDirectories = await readdir(endpointDir, { withFileTypes: true });
  } catch (error) {
    if (isMissingPathError(error)) {
      return null;
    }
    throw error;
  }

  let latest: RawProviderPayloadEnvelope | null = null;
  let latestFetchedAt = Number.NEGATIVE_INFINITY;

  for (const dateDirectory of dateDirectories) {
    if (!dateDirectory.isDirectory()) {
      continue;
    }

    const datedDir = join(endpointDir, dateDirectory.name);
    const files = await readdir(datedDir, { withFileTypes: true });
    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith('.json')) {
        continue;
      }

      const envelope = parseRawProviderPayload(await readFile(join(datedDir, file.name), 'utf8'));
      if (envelope.provider !== provider || envelope.endpointKey !== endpointKey) {
        throw providerRawPayloadInvalid('Raw payload identity does not match its evidence path');
      }

      const fetchedAt = Date.parse(envelope.fetchedAt);
      if (Number.isNaN(fetchedAt)) {
        throw providerRawPayloadInvalid('Raw payload fetchedAt is not a valid timestamp');
      }
      if (fetchedAt > latestFetchedAt) {
        latest = envelope;
        latestFetchedAt = fetchedAt;
      }
    }
  }

  return latest;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function sortedJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortedJson);
  }
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortedJson((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

function assertValidRawProviderPayload(envelope: RawProviderPayloadEnvelope): void {
  const validation = validateRawProviderPayloadEnvelope(envelope, OPENFOOTBALL_SOURCE_BINDING_POLICY);
  if (!validation.ok) {
    throw providerRawPayloadInvalid(validation.errors.join('; '));
  }
}

function parseRawProviderPayload(text: string): RawProviderPayloadEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw providerRawPayloadInvalid('Raw payload evidence is not valid JSON');
  }

  assertValidRawProviderPayload(parsed as RawProviderPayloadEnvelope);
  return parsed as RawProviderPayloadEnvelope;
}

function providerRawPayloadInvalid(message: string): Error & { code: 'provider_raw_payload_invalid' } {
  return Object.assign(new Error(`provider_raw_payload_invalid: ${message}`), {
    code: 'provider_raw_payload_invalid' as const
  });
}

function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
