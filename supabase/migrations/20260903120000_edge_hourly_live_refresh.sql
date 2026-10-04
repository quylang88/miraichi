create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

create or replace function miraichi_app.edge_scheduler_vault_secret(secret_name text)
returns text
language plpgsql
security definer
set search_path = pg_catalog, vault, net, cron
as $$
declare
  secret_values text[];
begin
  select array_agg(decrypted_secret order by id)
  into secret_values
  from vault.decrypted_secrets
  where name = secret_name;

  if coalesce(cardinality(secret_values), 0) <> 1
    or btrim(secret_values[1]) = '' then
    raise exception 'Required Edge scheduler Vault secret is missing or duplicated';
  end if;
  return secret_values[1];
end;
$$;

create or replace function miraichi_app.validate_edge_hourly_live_refresh()
returns void
language plpgsql
security definer
set search_path = pg_catalog, vault, net, cron
as $$
declare
  function_url text;
  gateway_token text;
  refresh_token text;
begin
  function_url := miraichi_app.edge_scheduler_vault_secret('miraichi_edge_function_url');
  gateway_token := miraichi_app.edge_scheduler_vault_secret('miraichi_edge_gateway_token');
  refresh_token := miraichi_app.edge_scheduler_vault_secret('miraichi_live_refresh_token');

  if function_url !~ '^https://[a-z0-9]+[.]supabase[.]co/functions/v1/miraichi-api$' then
    raise exception 'Edge scheduler function URL is invalid';
  end if;
  if octet_length(gateway_token) < 32 or octet_length(refresh_token) < 32 then
    raise exception 'Edge scheduler credentials are invalid';
  end if;
end;
$$;

create or replace function miraichi_app.invoke_edge_hourly_live_refresh()
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, vault, net, cron
as $$
declare
  request_id bigint;
  function_url text;
  gateway_token text;
  refresh_token text;
begin
  perform miraichi_app.validate_edge_hourly_live_refresh();
  function_url := miraichi_app.edge_scheduler_vault_secret('miraichi_edge_function_url');
  gateway_token := miraichi_app.edge_scheduler_vault_secret('miraichi_edge_gateway_token');
  refresh_token := miraichi_app.edge_scheduler_vault_secret('miraichi_live_refresh_token');

  select net.http_post(
    url := function_url || '/api/v1/live/refresh?reason=hourly',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-miraichi-gateway-token', gateway_token,
      'Authorization', 'Bearer ' || refresh_token,
      'x-region', 'eu-central-1'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 90000
  ) into request_id;
  return request_id;
end;
$$;

create or replace function miraichi_app.unschedule_edge_hourly_live_refresh()
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, vault, net, cron
as $$
declare
  job_ids bigint[];
  job_id bigint;
begin
  select array_agg(jobid order by jobid)
  into job_ids
  from cron.job
  where jobname = 'miraichi-edge-hourly-live-refresh';

  foreach job_id in array coalesce(job_ids, array[]::bigint[]) loop
    perform cron.unschedule(job_id);
  end loop;
  return coalesce(cardinality(job_ids), 0) > 0;
end;
$$;

create or replace function miraichi_app.configure_edge_hourly_live_refresh()
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, vault, net, cron
as $$
declare
  job_id bigint;
begin
  perform miraichi_app.validate_edge_hourly_live_refresh();
  perform miraichi_app.unschedule_edge_hourly_live_refresh();
  select cron.schedule(
    'miraichi-edge-hourly-live-refresh',
    '17 * * * *',
    'select miraichi_app.invoke_edge_hourly_live_refresh();'
  ) into job_id;
  return job_id;
end;
$$;

revoke all on function miraichi_app.edge_scheduler_vault_secret(text) from public;
revoke all on function miraichi_app.edge_scheduler_vault_secret(text) from anon;
revoke all on function miraichi_app.edge_scheduler_vault_secret(text) from authenticated;
revoke all on function miraichi_app.edge_scheduler_vault_secret(text) from service_role;
revoke all on function miraichi_app.validate_edge_hourly_live_refresh() from public;
revoke all on function miraichi_app.validate_edge_hourly_live_refresh() from anon;
revoke all on function miraichi_app.validate_edge_hourly_live_refresh() from authenticated;
revoke all on function miraichi_app.validate_edge_hourly_live_refresh() from service_role;
revoke all on function miraichi_app.invoke_edge_hourly_live_refresh() from public;
revoke all on function miraichi_app.invoke_edge_hourly_live_refresh() from anon;
revoke all on function miraichi_app.invoke_edge_hourly_live_refresh() from authenticated;
revoke all on function miraichi_app.invoke_edge_hourly_live_refresh() from service_role;
revoke all on function miraichi_app.configure_edge_hourly_live_refresh() from public;
revoke all on function miraichi_app.configure_edge_hourly_live_refresh() from anon;
revoke all on function miraichi_app.configure_edge_hourly_live_refresh() from authenticated;
revoke all on function miraichi_app.configure_edge_hourly_live_refresh() from service_role;
revoke all on function miraichi_app.unschedule_edge_hourly_live_refresh() from public;
revoke all on function miraichi_app.unschedule_edge_hourly_live_refresh() from anon;
revoke all on function miraichi_app.unschedule_edge_hourly_live_refresh() from authenticated;
revoke all on function miraichi_app.unschedule_edge_hourly_live_refresh() from service_role;
