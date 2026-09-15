begin;

alter table miraichi_app.bet_draft
  drop constraint if exists bet_draft_pre_bet_emotion_check;

update miraichi_app.bet_draft
set pre_bet_emotion = 'tilted'
where pre_bet_emotion in ('frustrated', 'anxious', 'tired');

alter table miraichi_app.bet_draft
  add constraint bet_draft_pre_bet_emotion_check
  check (pre_bet_emotion is null or pre_bet_emotion in ('calm', 'excited', 'tilted'));

alter table miraichi_app.bet_record
  drop constraint if exists bet_record_pre_bet_emotion_check;

update miraichi_app.bet_record
set pre_bet_emotion = 'tilted'
where pre_bet_emotion in ('frustrated', 'anxious', 'tired');

alter table miraichi_app.bet_record
  add constraint bet_record_pre_bet_emotion_check
  check (pre_bet_emotion is null or pre_bet_emotion in ('calm', 'excited', 'tilted'));

commit;
