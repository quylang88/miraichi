import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  assertLocalRestoreDatabaseUrl,
  runOwnerBackupCli,
  type OwnerBackupCliOperations
} from './owner-backup-cli.js';

describe('owner backup CLI', () => {
  it('rejects every non-local restore database before invoking restore operations', async () => {
    for (const url of [
      'postgresql://postgres:secret@db.example.com:5432/postgres',
      'postgresql://postgres:secret@10.0.0.5:5432/postgres'
    ]) expect(() => assertLocalRestoreDatabaseUrl(url)).toThrow('local database');
    expect(() => assertLocalRestoreDatabaseUrl('postgresql://postgres:postgres@127.0.0.1:15422/postgres'))
      .not.toThrow();

    let invoked = false;
    await expect(runOwnerBackupCli(['restore-local'], {
      env: { SUPABASE_DATABASE_URL: 'postgresql://postgres:secret@prod.example.com/postgres' },
      operations: { restoreLocal: async () => { invoked = true; throw new Error('should not run'); } }
    })).rejects.toThrow('local database');
    expect(invoked).toBe(false);
  });

  it('supports exactly create, verify-latest, and restore-local and emits sanitized JSON reports', async () => {
    const output: string[] = [];
    const operations: OwnerBackupCliOperations = {
      create: async () => ({
        receiptId: 'backup-123', objectKey: 'owner-backups/production/owner-primary/object.json',
        environment: 'production', ownerProfileId: 'owner-primary',
        schemaVersion: 'miraichi.cloud-backup.v3', exportedAt: '2026-09-27T12:00:00.000Z',
        payloadSha256: 'a'.repeat(64), ciphertextSha256: 'b'.repeat(64), storedBytes: 100,
        recordCounts: {
          ownerProfiles: 1, betDrafts: 0, bets: 0, bankrollAccounts: 0,
          bankrollLedgerEntries: 0, disciplineConfigs: 0, settlementEvents: 0
        }
      })
    };
    await runOwnerBackupCli(['create'], {
      env: {
        OWNER_BACKUP_KEY_BASE64: 'must-never-appear',
        R2_SECRET_ACCESS_KEY: 'also-must-never-appear'
      },
      operations,
      write: (line) => output.push(line)
    });
    expect(JSON.parse(output[0]!)).toMatchObject({ status: 'ok', command: 'create', receiptId: 'backup-123' });
    expect(output[0]).not.toContain('must-never-appear');
    expect(output[0]).not.toContain('also-must-never-appear');
    await expect(runOwnerBackupCli(['delete'], { operations })).rejects.toThrow('Unsupported owner backup command');
    await expect(runOwnerBackupCli(['create', '--extra'], { operations })).rejects.toThrow('does not accept arguments');
  });

  it('registers the three package scripts without a production-restore command', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };
    expect(pkg.scripts['backup:owner:create']).toContain('owner-backup-cli.ts create');
    expect(pkg.scripts['backup:owner:verify']).toContain('owner-backup-cli.ts verify-latest');
    expect(pkg.scripts['backup:owner:restore-local']).toContain('owner-backup-cli.ts restore-local');
    expect(Object.keys(pkg.scripts)).not.toContain('backup:owner:restore-production');
  });
});
