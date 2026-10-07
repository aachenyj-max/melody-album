create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create function public.agent_workbench_scheduled_maintenance() returns bigint
language plpgsql security invoker set search_path='' as $$
declare target text; token text; request_id bigint;
begin
  select decrypted_secret into target from vault.decrypted_secrets where name='agent_workbench_maintenance_url';
  select decrypted_secret into token from vault.decrypted_secrets where name='agent_workbench_maintenance_token';
  -- Deployment supplies these Vault entries. A hosted job must never call a developer's localhost.
  if target is null or token is null then return null; end if;
  if target !~ '^https://[^/?#:@]+(/api/internal/agent-workbench/maintenance)$' or length(token)<32 then raise exception 'WORKBENCH_MAINTENANCE_NOT_CONFIGURED'; end if;
  select net.http_post(url:=target,body:='{"contractVersion":1}'::jsonb,
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||token),
    timeout_milliseconds:=30000) into request_id;
  return request_id;
end $$;
revoke all on function public.agent_workbench_scheduled_maintenance() from public,anon,authenticated,service_role;
select cron.schedule('agent-workbench-hourly-maintenance','0 * * * *','select public.agent_workbench_scheduled_maintenance();');
