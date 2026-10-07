-- Expired execution leases cannot write and must not reserve a concurrency slot until the hourly sweep.
create or replace function public.agent_workbench_claim(p_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r public.agent_workbench_runs; token uuid;
begin
 perform pg_advisory_xact_lock(672006,2);
 select * into r from public.agent_workbench_runs where id=p_id and expires_at>now() for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if r.status in ('succeeded','partial','failed','interrupted') then return jsonb_build_object('terminal',true); end if;
 if r.status='running' then raise exception 'RUN_BUSY'; end if;
 if r.status<>'queued' or exists(select 1 from public.agent_workbench_assets where run_id=p_id and state<>'ready') then raise exception 'RUN_NOT_READY'; end if;
 if (select count(*) from public.agent_workbench_runs where status='running' and expires_at>now() and lease_expires_at>now())>=2 then raise exception 'CONCURRENCY_LIMIT'; end if;
 token:=gen_random_uuid();
 update public.agent_workbench_runs set status='running',started_at=now(),execution_token=token,lease_expires_at=now()+interval '240 seconds' where id=p_id;
 return jsonb_build_object('terminal',false,'token',token);
end $$;
revoke all on function public.agent_workbench_claim(uuid) from public,anon,authenticated;
grant execute on function public.agent_workbench_claim(uuid) to service_role;
