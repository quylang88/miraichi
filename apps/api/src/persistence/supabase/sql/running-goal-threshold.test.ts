import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('running goal threshold persistence', () => {
  it('mirrors the additive migration and keeps legacy rows nullable', () => {
    const migration=readFileSync('supabase/migrations/20260915150000_running_goal_threshold.sql','utf8').toLowerCase();
    const mirror=readFileSync('apps/api/src/persistence/supabase/sql/running-goal-threshold.sql','utf8').toLowerCase();
    expect(migration).toBe(mirror);
    for(const table of ['bet_record','bet_draft']){
      expect(migration).toContain(`alter table miraichi_app.${table}`);
      expect(migration).toContain(`${table}_running_goal_threshold_check`);
    }
    expect(migration.match(/add column if not exists running_goal_threshold numeric/g)).toHaveLength(2);
    expect(migration).toContain('0.5');expect(migration).toContain('0.75');
    expect(migration).not.toMatch(/\b(delete|truncate|update)\b/);
  });
});
