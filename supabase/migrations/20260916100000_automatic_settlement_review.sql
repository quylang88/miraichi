begin;

alter table miraichi_app.bet_record
  add column if not exists settlement_review_status text,
  add column if not exists settlement_review_reason text,
  add column if not exists settlement_evidence_at timestamptz,
  add constraint bet_record_settlement_review_check check (
    (settlement_review_status is null and settlement_review_reason is null and settlement_evidence_at is null)
    or (settlement_review_status = 'manual_required' and settlement_review_reason in (
      'missing_match_link', 'missing_match', 'invalid_match', 'match_not_completed', 'match_identity_mismatch',
      'invalid_selection', 'missing_detail', 'invalid_detail', 'stale_detail', 'incomplete_detail',
      'contradictory_detail', 'contradictory_score', 'extra_time_ambiguous', 'missing_half_time_score',
      'missing_corner_totals', 'missing_placement_minute', 'fixed_window_started', 'incomplete_goal_events',
      'invalid_goal_events'
    )
      and settlement_evidence_at is not null and status = 'pending')
    or (settlement_review_status = 'auto_settled' and settlement_review_reason is null
      and settlement_evidence_at is not null and status = 'settled')
  );

commit;
