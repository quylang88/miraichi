import { emptyCanonicalWarehouseSnapshot } from './canonical-merge.js';
import path from 'node:path';
import type {
  FieldProvenance,
  ProviderLink
} from '@miraichi/shared';
import {
  readCanonicalWarehouseRun,
  type CanonicalWarehouseSnapshot
} from '../../../../../scripts/providers/shared/canonical-warehouse.js';
import { readServingMatchStoreManifest } from '../../../../api/src/repositories/serving-match-store.js';

export async function loadLastGoodWarehouseSnapshot(
  dataRoot: string
): Promise<CanonicalWarehouseSnapshot> {
  try {
    const manifest = await readServingMatchStoreManifest(path.join(dataRoot, 'serving'));
    if (!manifest.warehouseRunId) {
      throw new Error(
        'Existing serving snapshot has no canonical warehouse run; refusing to replace last-good data.'
      );
    }
    return readCanonicalWarehouseRun(dataRoot, manifest.warehouseRunId);
  } catch (error) {
    if ((error as { code?: string }).code === 'serving_match_store_missing') {
      return emptyCanonicalWarehouseSnapshot();
    }
    throw error;
  }
}

export { emptyCanonicalWarehouseSnapshot, alignDeltaMatchIds, mergeCanonicalWarehouseSnapshots } from './canonical-merge.js';
