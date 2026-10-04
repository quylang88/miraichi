begin;
create or replace function miraichi_app.invoke_hosted_refresh(refresh_kind text)
returns bigint language plpgsql security definer
set search_path = pg_catalog, vault, net, cron
as $$
declare
  function_url text;
  gateway_token text;
  refresh_token text;
  route text;
  request_id bigint;
begin
  if refresh_kind not in ('current','terminal','live') then raise exception 'Invalid refresh kind'; end if;
  function_url := miraichi_app.edge_scheduler_vault_secret('miraichi_edge_function_url');
  gateway_token := miraichi_app.edge_scheduler_vault_secret('miraichi_edge_gateway_token');
  if function_url <> 'https://qpexxwmrnreooxftfucv.supabase.co/functions/v1/miraichi-api' then
    raise exception 'Scheduler is restricted to the approved Frankfurt project';
  end if;
  if refresh_kind = 'live' then
    refresh_token := miraichi_app.edge_scheduler_vault_secret('miraichi_live_refresh_token');
    route := '/api/v1/live/refresh?reason=background';
  else
    refresh_token := miraichi_app.edge_scheduler_vault_secret('miraichi_provider_refresh_token');
    route := '/api/internal/providers/' || refresh_kind || '/refresh';
  end if;
  if octet_length(gateway_token)<32 or octet_length(refresh_token)<32 then raise exception 'Invalid scheduler credential'; end if;
  select net.http_post(url := function_url || route,
    headers := jsonb_build_object('Content-Type','application/json',
      'x-miraichi-gateway-token',gateway_token,'Authorization','Bearer ' || refresh_token,
      'x-region', 'eu-central-1'), body := '{}'::jsonb, timeout_milliseconds := 120000) into request_id;
  return request_id;
end;
$$;

create or replace function miraichi_app.unschedule_hosted_refresh()
returns void language plpgsql security definer
set search_path = pg_catalog, cron
as $$
declare selected_job bigint;
begin
  for selected_job in select jobid from cron.job where jobname in
    ('miraichi-current-refresh','miraichi-terminal-refresh','miraichi-live-refresh') loop
    perform cron.unschedule(selected_job);
  end loop;
end;
$$;

create or replace function miraichi_app.configure_hosted_refresh()
returns void language plpgsql security definer
set search_path = pg_catalog, vault, net, cron
as $$
declare provider_token text;
begin
  perform miraichi_app.validate_edge_hourly_live_refresh();
  provider_token := miraichi_app.edge_scheduler_vault_secret('miraichi_provider_refresh_token');
  if octet_length(provider_token)<32 then raise exception 'Invalid provider scheduler credential'; end if;
  perform miraichi_app.unschedule_edge_hourly_live_refresh();
  perform miraichi_app.unschedule_hosted_refresh();
  perform cron.schedule('miraichi-current-refresh','*/5 * * * *', 'select miraichi_app.invoke_hosted_refresh(''current'');');
  perform cron.schedule('miraichi-terminal-refresh','* * * * *', 'select miraichi_app.invoke_hosted_refresh(''terminal'');');
  perform cron.schedule('miraichi-live-refresh','*/5 * * * *', 'select miraichi_app.invoke_hosted_refresh(''live'');');
end;
$$;
revoke all on function miraichi_app.invoke_hosted_refresh(text) from public, anon, authenticated, service_role;
revoke all on function miraichi_app.unschedule_hosted_refresh() from public, anon, authenticated, service_role;
revoke all on function miraichi_app.configure_hosted_refresh() from public, anon, authenticated, service_role;
commit;
