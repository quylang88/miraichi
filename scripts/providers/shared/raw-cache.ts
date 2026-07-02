import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RawProviderPayloadEnvelope } from '../../../packages/shared/src/contracts/provider-ingestion-contracts.js';

/**
 * Produce a stable SHA-256 hex digest of a payload, with canonical key ordering
 * so that semantically identical objects hash the same regardless of insertion order.
 */
export function createPayloadHash(payload: unknown): string {
  const stable = JSON.stringify(sortedJson(payload));
  return createHash('sha256').update(stable, 'utf8').digest('hex');
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
  const datePart = envelope.fetchedAt.slice(0, 10); // YYYY-MM-DD
  const dir = join(root, 'providers', envelope.provider, 'raw', envelope.endpointKey, datePart);
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, `${envelope.payloadHash}.json`);
  await writeFile(filePath, JSON.stringify(envelope, null, 2), 'utf8');
  return filePath;
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
