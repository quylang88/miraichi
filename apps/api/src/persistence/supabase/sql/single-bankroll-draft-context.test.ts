import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('single bankroll draft context schema',()=>{
  it('adds nullable owner-entered placement context without account or formula fields',()=>{const sql=readFileSync(resolve(process.cwd(),'supabase/migrations/20260901090000_single_bankroll_draft_context.sql'),'utf8').toLowerCase();for(const column of ['home_team_name','away_team_name','selection_label','pre_bet_emotion','pre_bet_motivation','pre_bet_note'])expect(sql).toContain(column);expect(sql).not.toMatch(/\b(roi|yield|clv|kelly|recommended_stake|bankroll_account_id)\b/i);});
});
