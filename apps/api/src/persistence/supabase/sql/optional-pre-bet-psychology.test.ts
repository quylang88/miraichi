import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = 'supabase/migrations/20260915140000_optional_pre_bet_psychology.sql';
const mirror = 'apps/api/src/persistence/supabase/sql/optional-pre-bet-psychology.sql';

describe('optional pre-bet psychology migration', () => {
  it('is additive and mirrored without rewriting legacy settlement events', () => {
    const sql = readFileSync(migration, 'utf8').toLowerCase();
    expect(sql).toBe(readFileSync(mirror, 'utf8').toLowerCase());
    expect(sql).toMatch(/alter table miraichi_app\.bet_settlement_event\s+alter column plan_adherence drop not null/);
    expect(sql).not.toMatch(/\b(delete|truncate|update)\b/);
    expect(sql).not.toContain('drop constraint');
  });
});
