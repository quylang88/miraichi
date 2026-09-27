import { describe, expect, it } from 'vitest';
import {
  discoverMigrationSet,
  overlayWorkingTreeMigrations,
  parseMigrationNameStatus,
  verifyMigrations,
  type MigrationRepository,
  type MigrationRunner
} from './verify-migrations.js';

const baseSha = 'a'.repeat(40);
const headSha = 'b'.repeat(40);
const initial = 'supabase/migrations/20260702052851_initial.sql';
const added = 'supabase/migrations/20260928000000_safe.sql';

function repository(diff = `A\t${added}\n`): MigrationRepository {
  const head = new Map([
    [initial, 'create schema if not exists miraichi_app;'],
    [added, 'alter table miraichi_app.backup_export_log add column if not exists verified_at timestamptz;']
  ]);
  return {
    diffNameStatus: () => diff,
    listHeadMigrationPaths: () => [...head.keys()],
    readHeadFile: (path) => head.get(path) ?? '',
    readBaseFile: (path) => path === initial ? 'create schema if not exists miraichi_app;' : ''
  };
}

describe('migration verification', () => {
  it('overlays uncommitted additions, modifications, and deletions before local verification', () => {
    const committed = discoverMigrationSet({ repository: repository(), baseSha, headSha });
    const localAdded = 'supabase/migrations/20260929000000_local.sql';
    expect(overlayWorkingTreeMigrations(committed, [
      { path: initial, sql: 'changed historical sql;' },
      { path: localAdded, sql: 'select 2;' }
    ])).toEqual([
      expect.objectContaining({ path: initial, change: 'modified', sql: 'changed historical sql;' }),
      expect.objectContaining({ path: added, change: 'deleted' }),
      expect.objectContaining({ path: localAdded, change: 'added', sql: 'select 2;' })
    ]);
  });

  it('discovers added migrations while retaining unchanged files in the set hash', () => {
    const migrations = discoverMigrationSet({ repository: repository(), baseSha, headSha });
    expect(migrations).toEqual([
      expect.objectContaining({ path: initial, change: 'unchanged' }),
      expect.objectContaining({ path: added, change: 'added' })
    ]);
  });

  it('treats rename as historical deletion plus a new file and parses deletes explicitly', () => {
    expect(parseMigrationNameStatus(`R100\t${initial}\t${added}\nD\t${initial}\n`)).toEqual([
      { status: 'deleted', path: initial },
      { status: 'added', path: added },
      { status: 'deleted', path: initial }
    ]);
  });

  it('runs empty and prior-schema executable gates only after static verification passes', async () => {
    const calls: string[] = [];
    const runner: MigrationRunner = {
      verifyEmptyDatabase: async (migrations) => {
        calls.push('empty');
        return { mode: 'empty', appliedMigrationCount: migrations.length, ownerDataPreserved: true, currentReaderCompatible: true, previousReaderCompatible: true };
      },
      verifyPriorSchema: async (migrations) => {
        calls.push('prior');
        return { mode: 'prior', appliedMigrationCount: migrations.length, ownerDataPreserved: true, currentReaderCompatible: true, previousReaderCompatible: true };
      }
    };
    const result = await verifyMigrations({ repository: repository(), runner, baseSha, headSha });
    expect(result.report.ok).toBe(true);
    expect(calls).toEqual(['empty', 'prior']);
    expect(result.emptyDatabase?.ownerDataPreserved).toBe(true);
    expect(result.priorSchema?.previousReaderCompatible).toBe(true);
  });

  it('does not touch a database when a historical migration changed', async () => {
    let runnerCalls = 0;
    const runner: MigrationRunner = {
      verifyEmptyDatabase: async () => { runnerCalls += 1; throw new Error('must not run'); },
      verifyPriorSchema: async () => { runnerCalls += 1; throw new Error('must not run'); }
    };
    const result = await verifyMigrations({
      repository: repository(`M\t${initial}\nA\t${added}\n`), runner, baseSha, headSha
    });
    expect(result.report.ok).toBe(false);
    expect(result.report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'historical_migration_changed' })
    ]));
    expect(runnerCalls).toBe(0);
    expect(result).not.toHaveProperty('emptyDatabase');
  });
});
