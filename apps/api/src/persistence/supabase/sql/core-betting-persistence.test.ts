import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('core betting persistence migration', () => {
  it('adds private discipline, settlement and audit structures without forbidden formulas', () => {
    const path = resolve(process.cwd(), 'supabase/migrations/20260821090000_core_betting_discipline.sql');
    const sql = readFileSync(path, 'utf8').toLowerCase();
    for (const table of ['discipline_config', 'discipline_challenge', 'bet_settlement_event']) {
      expect(sql).toContain(`create table if not exists miraichi_app.${table}`);
      expect(sql).toContain(`alter table miraichi_app.${table} enable row level security`);
    }
    for (const column of ['bankroll_account_id', 'pre_bet_emotion', 'pre_bet_motivation', 'settlement_type', 'profit_loss_points', 'settled_at']) {
      expect(sql).toContain(column);
    }
    expect(sql).toContain("'bet_settlement_correction'");
    expect(sql).toContain('unique (owner_profile_id, settlement_event_id)');
    expect(sql).toContain('revoke all on all tables in schema miraichi_app from anon, authenticated');
    expect(sql).not.toMatch(/\b(roi|yield|clv|kelly|recommended_stake|risk_score|expected_return)\b/i);
  });
});
