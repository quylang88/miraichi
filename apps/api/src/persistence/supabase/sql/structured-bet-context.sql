begin;

alter table miraichi_app.bet_draft
  add column if not exists selection_code text,
  add column if not exists market_period text,
  add column if not exists running_window text,
  add column if not exists window_start_minute integer,
  add column if not exists window_end_minute integer,
  add column if not exists live_score_home integer,
  add column if not exists live_score_away integer,
  add column if not exists live_minute integer,
  add column if not exists live_context_source text,
  add column if not exists live_context_observed_at timestamptz;

alter table miraichi_app.bet_record
  add column if not exists selection_code text,
  add column if not exists market_period text,
  add column if not exists running_window text,
  add column if not exists window_start_minute integer,
  add column if not exists window_end_minute integer,
  add column if not exists live_score_home integer,
  add column if not exists live_score_away integer,
  add column if not exists live_minute integer,
  add column if not exists live_context_source text,
  add column if not exists live_context_observed_at timestamptz;

alter table miraichi_app.bet_draft
  drop constraint if exists bet_draft_market_type_check,
  add constraint bet_draft_market_type_check
    check (market_type in ('1X2','over_under','handicap','corners','custom','running')),
  add constraint bet_draft_selection_code_check
    check (selection_code is null or selection_code in ('home','draw','away','over','under')),
  add constraint bet_draft_market_period_check
    check (market_period is null or market_period in ('full_time','first_half')),
  add constraint bet_draft_running_window_check
    check (running_window is null or running_window in ('to_half_time','to_full_time','fixed_15')),
  add constraint bet_draft_live_context_source_check
    check (live_context_source is null or live_context_source in ('snapshot','manual')),
  add constraint bet_draft_live_score_home_check
    check (live_score_home is null or live_score_home >= 0),
  add constraint bet_draft_live_score_away_check
    check (live_score_away is null or live_score_away >= 0),
  add constraint bet_draft_live_minute_check
    check (live_minute is null or (live_minute >= 0 and live_minute < 90)),
  add constraint bet_draft_running_window_minutes_check
    check (
      (running_window = 'fixed_15'
        and window_start_minute in (0,15,30,45,60,75)
        and window_end_minute = window_start_minute + 15)
      or
      (running_window is distinct from 'fixed_15'
        and window_start_minute is null
        and window_end_minute is null)
    ),
  add constraint bet_draft_live_context_observation_check
    check (
      (live_context_source is null and live_context_observed_at is null)
      or (live_context_source = 'snapshot' and live_context_observed_at is not null)
      or (live_context_source = 'manual' and live_context_observed_at is null)
    );

alter table miraichi_app.bet_record
  drop constraint if exists bet_record_market_type_check,
  add constraint bet_record_market_type_check
    check (market_type in ('1X2','over_under','handicap','corners','custom','running')),
  add constraint bet_record_selection_code_check
    check (selection_code is null or selection_code in ('home','draw','away','over','under')),
  add constraint bet_record_market_period_check
    check (market_period is null or market_period in ('full_time','first_half')),
  add constraint bet_record_running_window_check
    check (running_window is null or running_window in ('to_half_time','to_full_time','fixed_15')),
  add constraint bet_record_live_context_source_check
    check (live_context_source is null or live_context_source in ('snapshot','manual')),
  add constraint bet_record_live_score_home_check
    check (live_score_home is null or live_score_home >= 0),
  add constraint bet_record_live_score_away_check
    check (live_score_away is null or live_score_away >= 0),
  add constraint bet_record_live_minute_check
    check (live_minute is null or (live_minute >= 0 and live_minute < 90)),
  add constraint bet_record_running_window_minutes_check
    check (
      (running_window = 'fixed_15'
        and window_start_minute in (0,15,30,45,60,75)
        and window_end_minute = window_start_minute + 15)
      or
      (running_window is distinct from 'fixed_15'
        and window_start_minute is null
        and window_end_minute is null)
    ),
  add constraint bet_record_live_context_observation_check
    check (
      (live_context_source is null and live_context_observed_at is null)
      or (live_context_source = 'snapshot' and live_context_observed_at is not null)
      or (live_context_source = 'manual' and live_context_observed_at is null)
    );

commit;

