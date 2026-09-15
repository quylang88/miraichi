import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('simplified pre-bet emotion schema', () => {
  it('maps all legacy negative emotions before constraining drafts and bets', () => {
    const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260915130000_simplify_pre_bet_emotion.sql'), 'utf8').toLowerCase();
    const mirror = readFileSync(resolve(process.cwd(), 'apps/api/src/persistence/supabase/sql/simplify-pre-bet-emotion.sql'), 'utf8').toLowerCase();
    expect(mirror).toBe(migration);
    for (const table of ['bet_draft', 'bet_record']) {
      expect(migration).toContain(`update miraichi_app.${table}`);
      expect(migration).toContain(`alter table miraichi_app.${table}`);
    }
    for (const legacy of ['frustrated', 'anxious', 'tired']) expect(migration).toContain(`'${legacy}'`);
    for (const current of ['calm', 'excited', 'tilted']) expect(migration).toContain(`'${current}'`);
    for (const table of ['bet_draft', 'bet_record']) {
      const dropIndex = migration.indexOf(`drop constraint if exists ${table}_pre_bet_emotion_check`);
      const updateIndex = migration.indexOf(`update miraichi_app.${table}`);
      const addIndex = migration.indexOf(`add constraint ${table}_pre_bet_emotion_check`);
      expect(dropIndex).toBeLessThan(updateIndex);
      expect(updateIndex).toBeLessThan(addIndex);
    }
  });
});
