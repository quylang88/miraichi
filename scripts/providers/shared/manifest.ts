import { mkdir, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  ProviderId,
  ProviderCaptureManifestEntry
} from '../../../packages/shared/src/contracts/provider-ingestion-contracts.js';

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
  const dir = join(root, 'providers', provider, 'manifests');
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, 'capture-manifest.jsonl');
  await appendFile(filePath, JSON.stringify(entry) + '\n', 'utf8');
}
