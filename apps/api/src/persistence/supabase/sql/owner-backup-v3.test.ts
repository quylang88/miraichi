import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('owner backup V3 migration', () => {
  it('extends only the backup receipt schema-version constraint', () => {
    const sql = readFileSync('apps/api/src/persistence/supabase/sql/owner-backup-v3.sql', 'utf8');
    const migration = readdirSync('supabase/migrations')
      .find((file) => file.endsWith('_owner_backup_v3.sql'));
    expect(migration).toBeDefined();
    expect(readFileSync(`supabase/migrations/${migration}`, 'utf8')).toBe(sql);
    expect(sql).toContain("'miraichi.cloud-backup.v3'");
    expect(sql).toContain('backup_export_log_schema_version_check');
    expect(sql).not.toMatch(/drop\s+(?:table|column)/iu);
    expect(sql).not.toMatch(/truncate|delete\s+from/iu);
  });
});
