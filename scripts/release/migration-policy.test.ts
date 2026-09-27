import { describe, expect, it } from 'vitest';
import { auditMigrationSql, verifyMigrationSet, type MigrationFile } from './migration-policy.js';

const path = 'supabase/migrations/20260928000000_candidate.sql';

describe('migration policy', () => {
  it.each([
    ['linked reset', 'select run_command(\'supabase db reset --linked\');', 'linked_reset'],
    ['truncate', 'truncate table miraichi_app.bet_record;', 'truncate'],
    ['owner table deletion', 'drop table miraichi_app.bet_record;', 'owner_table_drop'],
    ['owner column deletion', 'alter table miraichi_app.bet_record drop column notes;', 'owner_column_drop'],
    ['owner cascade', 'alter table miraichi_app.bet_record add constraint bet_owner_fk foreign key (owner_profile_id) references miraichi_app.app_profile(id) on delete cascade;', 'owner_delete_cascade'],
    ['lossy type change', 'alter table miraichi_app.bet_record alter column notes type varchar(20);', 'lossy_type_change'],
    ['unbounded update', "update miraichi_app.bet_record set notes = '';", 'unbounded_owner_update'],
    ['unbounded delete', 'delete from miraichi_app.bet_record;', 'unbounded_owner_delete'],
    ['dynamic SQL', "execute 'truncate table miraichi_app.bet_record';", 'dynamic_sql']
  ])('rejects %s', (_label, sql, rule) => {
    expect(auditMigrationSql(path, sql)).toEqual(expect.arrayContaining([
      expect.objectContaining({ path, rule, severity: 'error' })
    ]));
  });

  it('accepts the additive V3 constraint replacement and bounded idempotent backfills', () => {
    const sql = `
      begin;
      alter table miraichi_app.backup_export_log
        drop constraint if exists backup_export_log_schema_version_check,
        add constraint backup_export_log_schema_version_check check (
          schema_version in ('miraichi.cloud-backup.v1','miraichi.cloud-backup.v2','miraichi.cloud-backup.v3')
        );
      update miraichi_app.bet_record
        set tags = '[]'::jsonb
        where tags is null;
      commit;
    `;
    expect(auditMigrationSql(path, sql)).toEqual([]);
  });

  it('rejects contract removal unless the same constraint is restored or compatibility is declared', () => {
    const removal = 'alter table miraichi_app.bet_record drop constraint bet_record_status_check;';
    expect(auditMigrationSql(path, removal)).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'contract_removal' })
    ]));
    expect(auditMigrationSql(path, `-- miraichi:compatibility adr-0042\n${removal}`)).toEqual([]);
  });

  it('rejects modified or deleted historical migrations and hashes the complete ordered set', () => {
    const migrations: MigrationFile[] = [{
      path: 'supabase/migrations/20260702052851_initial.sql', sql: 'select 1;', change: 'modified'
    }, {
      path: 'supabase/migrations/20260928000000_additive.sql', sql: 'create index concurrently if not exists bet_owner_idx on miraichi_app.bet_record(owner_profile_id);', change: 'added'
    }];
    const report = verifyMigrationSet({ baseSha: 'a'.repeat(40), headSha: 'b'.repeat(40), migrations });
    expect(report.ok).toBe(false);
    expect(report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'historical_migration_changed' })
    ]));
    expect(report.migrationHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(verifyMigrationSet({
      baseSha: 'a'.repeat(40), headSha: 'b'.repeat(40),
      migrations: migrations.map((migration) => migration.path.includes('initial')
        ? { ...migration, sql: 'select 2;' }
        : migration)
    }).migrationHash).not.toBe(report.migrationHash);
  });
});
