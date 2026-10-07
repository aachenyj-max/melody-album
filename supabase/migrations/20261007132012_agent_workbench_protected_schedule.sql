create or replace function public.agent_workbench_scheduled_maintenance() returns bigint
language plpgsql security invoker set search_path='' as $$
declare target text; token text; protection_bypass text; request_id bigint; request_headers jsonb;
begin
  select decrypted_secret into target from vault.decrypted_secrets where name='agent_workbench_maintenance_url';
  select decrypted_secret into token from vault.decrypted_secrets where name='agent_workbench_maintenance_token';
  select decrypted_secret into protection_bypass from vault.decrypted_secrets where name='agent_workbench_protection_bypass';
  if target is null or token is null then return null; end if;
  if target !~ '^https://[^/?#:@]+(/api/internal/agent-workbench/maintenance)$' or length(token)<32 then
    raise exception 'WORKBENCH_MAINTENANCE_NOT_CONFIGURED';
  end if;
  request_headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||token);
  if protection_bypass is not null then
    if protection_bypass !~ '^[A-Za-z0-9]{32}$' then raise exception 'WORKBENCH_PROTECTION_BYPASS_INVALID'; end if;
    request_headers := request_headers || jsonb_build_object('x-vercel-protection-bypass',protection_bypass);
  end if;
  select net.http_post(url:=target,body:='{"contractVersion":1}'::jsonb,
    headers:=request_headers,timeout_milliseconds:=30000) into request_id;
  return request_id;
end $$;
revoke all on function public.agent_workbench_scheduled_maintenance() from public,anon,authenticated,service_role;
