alter table public.agent_workbench_runs add column cleanup_token uuid, add column cleanup_lease_expires_at timestamptz;

create function public.agent_workbench_maintenance_claim(p_token uuid,p_limit integer default 50) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r public.agent_workbench_runs; recovered integer:=0; selected uuid[]:='{}';
begin
  perform pg_advisory_xact_lock(672006,3);
  for r in select * from public.agent_workbench_runs
    where (status='running' and lease_expires_at<=now()) or (status in ('uploading','queued') and created_at<=now()-interval '10 minutes')
    order by created_at limit 50 for update skip locked
  loop
    update public.agent_workbench_steps set status='interrupted',ended_at=now(),error=jsonb_build_object('code','RUN_INTERRUPTED','message','执行租约或输入准备已超时，请手动重跑。','retryable',true,'stage',stage)
      where run_id=r.id and status in ('pending','running');
    update public.agent_workbench_runs set status='interrupted',ended_at=now(),execution_token=null,lease_expires_at=null,
      error=jsonb_build_object('code','RUN_INTERRUPTED','message','执行租约或输入准备已超时，请手动重跑。','retryable',true,'stage',null),
      summary=jsonb_build_object('kind','internal_test','status','interrupted','recoveredByMaintenance',true) where id=r.id;
    recovered:=recovered+1;
  end loop;
  with due as (select id from public.agent_workbench_runs where expires_at<=now()
    and (cleanup_lease_expires_at is null or cleanup_lease_expires_at<=now())
    order by expires_at,id limit least(greatest(p_limit,1),50) for update skip locked),
  claimed as (update public.agent_workbench_runs r set cleanup_token=p_token,cleanup_lease_expires_at=now()+interval '60 seconds'
    from due where r.id=due.id returning r.id)
  select coalesce(array_agg(id),'{}') into selected from claimed;
  update public.agent_workbench_assets set state='delete_pending' where run_id=any(selected);
  return jsonb_build_object('recoveredRuns',recovered,'runs',
    (select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'paths',
      (select coalesce(jsonb_agg(a.storage_path),'[]') from public.agent_workbench_assets a where a.run_id=r.id))),'[]')
     from public.agent_workbench_runs r where r.id=any(selected)),
    'hasMore',exists(select 1 from public.agent_workbench_runs where expires_at<=now() and not(id=any(selected))));
end $$;
create function public.agent_workbench_maintenance_delete(p_id uuid,p_token uuid,p_success boolean) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
  perform 1 from public.agent_workbench_runs where id=p_id and expires_at<=now() and cleanup_token=p_token for update;
  if not found then return false; end if;
  if p_success then delete from public.agent_workbench_runs where id=p_id and cleanup_token=p_token;
  else update public.agent_workbench_runs set cleanup_token=null,cleanup_lease_expires_at=null where id=p_id;
  end if;
  return true;
end $$;
revoke all on function public.agent_workbench_maintenance_claim(uuid,integer),public.agent_workbench_maintenance_delete(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.agent_workbench_maintenance_claim(uuid,integer),public.agent_workbench_maintenance_delete(uuid,uuid,boolean) to service_role;
