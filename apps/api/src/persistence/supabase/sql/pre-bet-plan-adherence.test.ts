import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('pre-bet plan adherence schema', () => {
  it('stores nullable legacy-compatible adherence on drafts and bet records', () => {
    const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260901100000_pre_bet_plan_adherence.sql'), 'utf8').toLowerCase();
    expect(sql).toContain('alter table miraichi_app.bet_draft');
    expect(sql).toContain('alter table miraichi_app.bet_record');
    expect(sql.match(/pre_bet_plan_adherence/g)?.length).toBeGreaterThanOrEqual(4);
    for (const value of ['yes', 'partly', 'no']) expect(sql).toContain(`'${value}'`);
  });
});
