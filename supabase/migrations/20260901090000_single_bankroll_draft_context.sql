begin;

alter table miraichi_app.bet_draft
  add column if not exists home_team_name text,
  add column if not exists away_team_name text,
  add column if not exists selection_label text,
  add column if not exists pre_bet_emotion text,
  add column if not exists pre_bet_motivation text,
  add column if not exists pre_bet_note text;

alter table miraichi_app.bet_draft
  drop constraint if exists bet_draft_pre_bet_emotion_check,
  add constraint bet_draft_pre_bet_emotion_check check (pre_bet_emotion is null or pre_bet_emotion in ('calm','excited','frustrated','anxious','tired')),
  drop constraint if exists bet_draft_pre_bet_motivation_check,
  add constraint bet_draft_pre_bet_motivation_check check (pre_bet_motivation is null or pre_bet_motivation in ('planned_analysis','familiar_market','chasing_loss','fomo','impulse','other'));

commit;
