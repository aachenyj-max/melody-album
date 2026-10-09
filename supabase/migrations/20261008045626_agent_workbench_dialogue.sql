-- Editable, versioned workbench instructions. Credentials and executable tool
-- definitions remain code/secret owned.
create table public.agent_workbench_config_versions (
  version bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  prompt_text text not null check (char_length(prompt_text) between 20 and 8000),
  skill_text text not null check (char_length(skill_text) between 20 and 8000),
  max_turns integer not null check (max_turns between 1 and 6),
  max_output_tokens integer not null check (max_output_tokens between 512 and 2048),
  active boolean not null default false
);
create unique index agent_workbench_one_active_config on public.agent_workbench_config_versions(active) where active;
alter table public.agent_workbench_config_versions enable row level security;
revoke all on public.agent_workbench_config_versions from public, anon, authenticated;
grant select, insert, update on public.agent_workbench_config_versions to service_role;

create function public.agent_workbench_config_save(
  p_expected_version bigint, p_prompt text, p_skill text,
  p_max_turns integer, p_max_output_tokens integer
) returns public.agent_workbench_config_versions
language plpgsql security invoker set search_path = '' as $$
declare latest bigint; saved public.agent_workbench_config_versions;
begin
  perform pg_advisory_xact_lock(67200801);
  select version into latest from public.agent_workbench_config_versions where active for update;
  if coalesce(latest, 0) <> p_expected_version then raise exception 'CONFIG_CONFLICT'; end if;
  if char_length(p_prompt) not between 20 and 8000 or
     char_length(p_skill) not between 20 and 8000 or
     p_max_turns not between 1 and 6 or
     p_max_output_tokens not between 512 and 2048 then
    raise exception 'INVALID_CONFIG';
  end if;
  update public.agent_workbench_config_versions set active = false where active;
  insert into public.agent_workbench_config_versions(prompt_text, skill_text, max_turns, max_output_tokens, active)
  values (p_prompt, p_skill, p_max_turns, p_max_output_tokens, true) returning * into saved;
  return saved;
end $$;
revoke all on function public.agent_workbench_config_save(bigint,text,text,integer,integer) from public, anon, authenticated;
grant execute on function public.agent_workbench_config_save(bigint,text,text,integer,integer) to service_role;

-- A dialogue belongs to an existing immutable run and expires with it.
create table public.agent_workbench_dialogues (
  run_id uuid primary key references public.agent_workbench_runs(id) on delete cascade,
  created_at timestamptz not null default now(),
  revision integer not null default 0,
  phase text not null default 'discussing' check (phase in ('discussing','proposed','approved','generated')),
  messages jsonb not null default '[]' check (jsonb_typeof(messages) = 'array' and jsonb_array_length(messages) <= 80),
  proposal jsonb,
  music_versions jsonb not null default '[]' check (jsonb_typeof(music_versions) = 'array' and jsonb_array_length(music_versions) <= 12),
  lease_token uuid,
  lease_expires_at timestamptz,
  check ((lease_token is null) = (lease_expires_at is null))
);
alter table public.agent_workbench_dialogues enable row level security;
revoke all on public.agent_workbench_dialogues from public, anon, authenticated;
grant select, insert, update on public.agent_workbench_dialogues to service_role;

create function public.agent_workbench_dialogue_claim(p_id uuid, p_token uuid)
returns public.agent_workbench_dialogues language plpgsql security invoker set search_path = '' as $$
declare d public.agent_workbench_dialogues;
begin
  select d0.* into d from public.agent_workbench_dialogues d0
    join public.agent_workbench_runs r on r.id = d0.run_id
    where d0.run_id = p_id and r.expires_at > now() for update of d0;
  if not found then raise exception 'NOT_FOUND'; end if;
  if d.lease_expires_at > now() then raise exception 'DIALOGUE_BUSY'; end if;
  update public.agent_workbench_dialogues
    set lease_token = p_token, lease_expires_at = now() + interval '240 seconds'
    where run_id = p_id returning * into d;
  return d;
end $$;
create function public.agent_workbench_dialogue_commit(
  p_id uuid, p_token uuid, p_phase text, p_messages jsonb,
  p_proposal jsonb, p_music_versions jsonb
) returns public.agent_workbench_dialogues
language plpgsql security invoker set search_path = '' as $$
declare d public.agent_workbench_dialogues;
begin
  update public.agent_workbench_dialogues
    set phase = p_phase, messages = p_messages, proposal = p_proposal,
        music_versions = p_music_versions, revision = revision + 1,
        lease_token = null, lease_expires_at = null
    where run_id = p_id and lease_token = p_token and lease_expires_at > now()
      and exists(select 1 from public.agent_workbench_runs where id = p_id and expires_at > now())
    returning * into d;
  if not found then raise exception 'DIALOGUE_CONFLICT'; end if;
  return d;
end $$;
create function public.agent_workbench_dialogue_release(p_id uuid, p_token uuid)
returns void language sql security invoker set search_path = '' as $$
  update public.agent_workbench_dialogues set lease_token = null, lease_expires_at = null
  where run_id = p_id and lease_token = p_token
$$;
revoke all on function public.agent_workbench_dialogue_claim(uuid,uuid), public.agent_workbench_dialogue_commit(uuid,uuid,text,jsonb,jsonb,jsonb), public.agent_workbench_dialogue_release(uuid,uuid) from public, anon, authenticated;
grant execute on function public.agent_workbench_dialogue_claim(uuid,uuid), public.agent_workbench_dialogue_commit(uuid,uuid,text,jsonb,jsonb,jsonb), public.agent_workbench_dialogue_release(uuid,uuid) to service_role;

-- Waiting for a human confirmation is an intentional state, not an abandoned run.
create or replace function public.agent_workbench_maintenance_claim(p_token uuid,p_limit integer default 50) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare current_run public.agent_workbench_runs; recovered integer:=0; selected uuid[]:='{}';
begin
  perform pg_advisory_xact_lock(672006,3);
  for current_run in select * from public.agent_workbench_runs
    where (status='running' and lease_expires_at<=now()) or
       (status in ('uploading','queued') and created_at<=now()-interval '10 minutes'
        and not exists(select 1 from public.agent_workbench_dialogues d where d.run_id=agent_workbench_runs.id))
    order by created_at limit 50 for update skip locked
  loop
    update public.agent_workbench_steps set status='interrupted',ended_at=now(),error=jsonb_build_object('code','RUN_INTERRUPTED','message','执行租约或输入准备已超时，请手动重跑。','retryable',true,'stage',stage)
      where run_id=current_run.id and status in ('pending','running');
    update public.agent_workbench_runs set status='interrupted',ended_at=now(),execution_token=null,lease_expires_at=null,
      error=jsonb_build_object('code','RUN_INTERRUPTED','message','执行租约或输入准备已超时，请手动重跑。','retryable',true,'stage',null),
      summary=jsonb_build_object('kind','internal_test','status','interrupted','recoveredByMaintenance',true)
      where id=current_run.id;
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
