import { createHash } from 'node:crypto';
import type {
  FieldProvenance,
  ProviderId
} from '../../../packages/shared/src/contracts/provider-ingestion-contracts.js';

export interface CreateFieldProvenanceInput {
  entityType: FieldProvenance['entityType'];
  entityId: string;
  fieldPath: string;
  provider: ProviderId;
  providerEntityId: string;
  /** The field value being recorded; serialized with canonical key ordering for hashing */
  value: unknown;
  observedAt: string;
  confidence: number;
}

/**
 * Create a FieldProvenance record.
 *
 * The `valueHash` is a SHA-256 hex digest of the value serialized with
 * canonical (sorted) key ordering, so that semantically identical objects
 * produce identical hashes regardless of insertion order.
 */
export function createFieldProvenance(input: CreateFieldProvenanceInput): FieldProvenance {
  return {
    entityType: input.entityType,
    entityId: input.entityId,
    fieldPath: input.fieldPath,
    provider: input.provider,
    providerEntityId: input.providerEntityId,
    observedAt: input.observedAt,
    confidence: input.confidence,
    valueHash: hashValue(input.value)
  };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function hashValue(value: unknown): string {
  const stable = JSON.stringify(sortedJson(value));
  return createHash('sha256').update(stable, 'utf8').digest('hex');
}

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
