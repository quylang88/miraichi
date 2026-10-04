import { describe, expect, it } from 'vitest';
import {
  createLocalSupabaseMigrationRunner,
  workingTreeMigrations
} from '../../scripts/release/verify-migrations.js';

describe('production migration preservation', () => {
  it('applies the full set to empty storage and preserves byte-equivalent prior owner rows', async () => {
    const migrations = workingTreeMigrations();
    const runner = createLocalSupabaseMigrationRunner();
    try {
      const empty = await runner.verifyEmptyDatabase(migrations);
      expect(empty).toMatchObject({
        mode: 'empty', appliedMigrationCount: migrations.length,
        ownerDataPreserved: true, currentReaderCompatible: true, previousReaderCompatible: true
      });
      const prior = await runner.verifyPriorSchema(migrations);
      expect(prior).toMatchObject({
        mode: 'prior', appliedMigrationCount: migrations.length,
        ownerDataPreserved: true, currentReaderCompatible: true, previousReaderCompatible: true
      });
    } finally {
      await runner.verifyEmptyDatabase(migrations);
    }
  }, 360_000);
});
