begin;

alter table miraichi_app.match_record
  drop constraint if exists match_record_competition_type_check;

alter table miraichi_app.match_record
  add constraint match_record_competition_type_check
  check (competition_type in ('national-team', 'club'));

commit;
