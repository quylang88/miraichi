begin;
alter table miraichi_app.live_refresh_state drop constraint live_refresh_state_reason_check;
alter table miraichi_app.live_refresh_state add constraint live_refresh_state_reason_check
  check (reason in ('visible','manual','hourly','background'));
alter table miraichi_app.live_refresh_state drop constraint live_refresh_state_last_error_code_check;
alter table miraichi_app.live_refresh_state add constraint live_refresh_state_last_error_code_check
  check (last_error_code is null or last_error_code in
    ('upstream_timeout','upstream_blocked','upstream_unavailable','upstream_contract_invalid','persistence_unavailable','internal_error'));
commit;
