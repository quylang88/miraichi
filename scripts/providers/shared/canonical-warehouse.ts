import { mkdir, appendFile } from 'node:fs/promises';
import { join } from 'node:path';

export type WarehouseCollection =
  | 'canonical-matches'
  | 'canonical-teams'
  | 'canonical-competitions'
  | 'match-provider-links'
  | 'match-events'
  | 'match-team-stats'
  | 'field-provenance'
  | 'conflicts';

/**
 * Append a canonical record to the provider-neutral warehouse at:
 *   <root>/warehouse/<collection>.jsonl
 *
 * Each line is a compact JSON object. Provider-specific adapters may write to
 * it; the warehouse survives adapter replacement.
 */
export async function appendCanonicalWarehouseRecord(
  root: string,
  collection: WarehouseCollection,
  record: unknown
): Promise<void> {
  const dir = join(root, 'warehouse');
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, `${collection}.jsonl`);
  await appendFile(filePath, JSON.stringify(record) + '\n', 'utf8');
}
