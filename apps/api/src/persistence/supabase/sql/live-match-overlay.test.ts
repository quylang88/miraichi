import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('live match overlay schema', () => {
  it('keeps one last-good overlay and one durable owner refresh lease with locked-down access', () => {
    const mirror = readFileSync(resolve(process.cwd(), 'apps/api/src/persistence/supabase/sql/live-match-overlay.sql'), 'utf8');
    const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260902120000_live_match_overlay.sql'), 'utf8');
    expect(migration).toBe(mirror);
    const sql = migration.toLowerCase();
    for (const table of ['live_match_snapshot', 'live_refresh_state']) expect(sql).toContain(`create table if not exists miraichi_app.${table}`);
    expect(sql).toContain('overlay_json jsonb not null');
    expect(sql).toContain('primary key references miraichi_app.app_profile(id)');
    expect(sql).toContain('enable row level security');
    expect(sql).toContain('revoke all');
    expect(sql).not.toContain('sportscore');
  });
});
