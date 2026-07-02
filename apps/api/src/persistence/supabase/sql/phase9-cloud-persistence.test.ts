import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('phase 9 private persistence schema', () => {
  it('keeps all owner data private and excludes forbidden betting calculations', () => {
    const sql = readFileSync(resolve(process.cwd(), 'apps/api/src/persistence/supabase/sql/phase9-cloud-persistence.sql'), 'utf8').toLowerCase();
    expect(sql).toContain('create schema if not exists miraichi_app');
    expect(sql).toContain('enable row level security');
    expect(sql).toContain('revoke all on schema miraichi_app from anon, authenticated');
    expect(sql).not.toMatch(/grant\s+.+\s+to\s+(anon|authenticated)/i);
    expect(sql).not.toMatch(/security\s+definer/i);
    expect(sql).not.toMatch(/\b(roi|yield|clv|kelly|recommended_stake|risk_score)\b/i);
    for (const table of ['app_profile', 'match_snapshot', 'match_record', 'bet_draft', 'bet_record', 'bankroll_account', 'bankroll_ledger_entry', 'backup_export_log']) {
      expect(sql).toContain(`create table if not exists miraichi_app.${table}`);
      expect(sql).toContain(`alter table miraichi_app.${table} enable row level security`);
    }
  });
});
