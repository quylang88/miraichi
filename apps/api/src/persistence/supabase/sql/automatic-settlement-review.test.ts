import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AUTOMATIC_SETTLEMENT_REVIEW_REASONS } from '@miraichi/shared';

const migration = 'supabase/migrations/20260916100000_automatic_settlement_review.sql';
const mirror = 'apps/api/src/persistence/supabase/sql/automatic-settlement-review.sql';

describe('automatic settlement review persistence', () => {
  it('is additive, mirrored and constrains review state without rewriting owner data', () => {
    const sql = readFileSync(migration, 'utf8').toLowerCase();
    expect(sql).toBe(readFileSync(mirror, 'utf8').toLowerCase());
    for (const column of ['settlement_review_status', 'settlement_review_reason', 'settlement_evidence_at']) {
      expect(sql).toContain(`add column if not exists ${column}`);
    }
    expect(sql).toContain('bet_record_settlement_review_check');
    expect(sql).toContain("'manual_required'");
    expect(sql).toContain("'auto_settled'");
    for (const reason of AUTOMATIC_SETTLEMENT_REVIEW_REASONS) expect(sql).toContain(`'${reason}'`);
    expect(sql).not.toMatch(/\b(delete|truncate|update)\b/);
  });
});
