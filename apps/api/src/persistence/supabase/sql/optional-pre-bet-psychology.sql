-- Existing settlement events retain their original adherence; new emotion-only bets may omit it.
alter table miraichi_app.bet_settlement_event
  alter column plan_adherence drop not null;
