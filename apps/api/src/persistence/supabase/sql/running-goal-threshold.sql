begin;

alter table miraichi_app.bet_draft
  add column if not exists running_goal_threshold numeric(4,2),
  add constraint bet_draft_running_goal_threshold_check
    check (running_goal_threshold is null or (market_type = 'running'
      and running_goal_threshold in (0.5, 0.75)
      and (running_window is distinct from 'fixed_15' or running_goal_threshold = 0.5)));

alter table miraichi_app.bet_record
  add column if not exists running_goal_threshold numeric(4,2),
  add constraint bet_record_running_goal_threshold_check
    check (running_goal_threshold is null or (market_type = 'running'
      and running_goal_threshold in (0.5, 0.75)
      and (running_window is distinct from 'fixed_15' or running_goal_threshold = 0.5)));

commit;
