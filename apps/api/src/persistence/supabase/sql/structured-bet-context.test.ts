import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260915120000_structured_bet_context.sql'
);

describe('structured bet context schema', () => {
  it('adds nullable normalized selection and live-context columns to drafts and bets', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

    expect(sql).toContain('alter table miraichi_app.bet_draft');
    expect(sql).toContain('alter table miraichi_app.bet_record');
    for (const column of [
      'selection_code',
      'market_period',
      'running_window',
      'window_start_minute',
      'window_end_minute',
      'live_score_home',
      'live_score_away',
      'live_minute',
      'live_context_source',
      'live_context_observed_at'
    ]) {
      expect(sql.match(new RegExp(column, 'g'))?.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('allows running while constraining normalized values and non-negative live context', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

    expect(sql).toContain("'running'");
    for (const value of ['home', 'draw', 'away', 'over', 'under']) expect(sql).toContain(`'${value}'`);
    for (const value of ['full_time', 'first_half']) expect(sql).toContain(`'${value}'`);
    for (const value of ['to_half_time', 'to_full_time', 'fixed_15']) expect(sql).toContain(`'${value}'`);
    for (const value of ['snapshot', 'manual']) expect(sql).toContain(`'${value}'`);
    expect(sql).toMatch(/live_score_home\s*>=\s*0/);
    expect(sql).toMatch(/live_score_away\s*>=\s*0/);
    expect(sql).toMatch(/live_minute\s*>=\s*0/);
    expect(sql).toMatch(/live_minute\s*<\s*90/);
    expect(sql).toContain('window_end_minute = window_start_minute + 15');
  });
});
