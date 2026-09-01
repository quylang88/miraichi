begin;

alter table miraichi_app.bet_draft
  add column if not exists pre_bet_plan_adherence text;

alter table miraichi_app.bet_record
  add column if not exists pre_bet_plan_adherence text;

alter table miraichi_app.bet_draft
  drop constraint if exists bet_draft_pre_bet_plan_adherence_check,
  add constraint bet_draft_pre_bet_plan_adherence_check check (pre_bet_plan_adherence is null or pre_bet_plan_adherence in ('yes','partly','no'));

alter table miraichi_app.bet_record
  drop constraint if exists bet_record_pre_bet_plan_adherence_check,
  add constraint bet_record_pre_bet_plan_adherence_check check (pre_bet_plan_adherence is null or pre_bet_plan_adherence in ('yes','partly','no'));

commit;
