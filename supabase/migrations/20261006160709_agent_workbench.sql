create table public.agent_workbench_runs (
  id uuid primary key,
  request_id uuid not null unique,
  parent_run_id uuid,
  kind text not null default 'internal_test' check (kind = 'internal_test'),
  status text not null default 'uploading' check (status in ('uploading','queued','running','succeeded','partial','failed','interrupted')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  started_at timestamptz, ended_at timestamptz, lease_expires_at timestamptz,
  input_snapshot jsonb not null,
  config_snapshot jsonb not null,
  input_digest text not null check (input_digest ~ '^[0-9a-f]{64}$'),
  config_digest text not null check (config_digest ~ '^[0-9a-f]{64}$'),
  execution_token uuid,
  error jsonb, summary jsonb,
  check (expires_at = created_at + interval '30 days'),
  check (input_snapshot->>'contractVersion' = '1'),
  check (config_snapshot->>'schemaVersion' = '1')
);
create table public.agent_workbench_steps (
  run_id uuid not null references public.agent_workbench_runs(id) on delete cascade,
  stage text not null check (stage in ('input','memory','music_profile','ai_music','qq_recommendations','summary')),
  status text not null default 'pending' check (status in ('pending','running','succeeded','failed','skipped','interrupted')),
  driver text not null check (driver in ('pi','pipeline')),
  source text not null default 'none' check (source in ('agent','demo','api','mock','deterministic','none')),
  started_at timestamptz, ended_at timestamptz,
  result jsonb, error jsonb,
  calls jsonb not null default '[]' check (jsonb_typeof(calls)='array' and jsonb_array_length(calls)<=32),
  events jsonb not null default '[]' check (jsonb_typeof(events)='array' and jsonb_array_length(events)<=256),
  primary key(run_id,stage)
);
create table public.agent_workbench_assets (
  id uuid primary key,
  run_id uuid not null references public.agent_workbench_runs(id) on delete cascade,
  position smallint not null check (position between 0 and 8),
  storage_path text not null unique,
  mime_type text not null default 'image/jpeg' check (mime_type='image/jpeg'),
  byte_size bigint not null check (byte_size>0 and byte_size<=3670016),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  state text not null default 'reserved' check (state in ('reserved','ready','failed','delete_pending')),
  created_at timestamptz not null default now(),
  unique(run_id,position),
  check (storage_path='runs/'||run_id::text||'/photos/'||position::text||'.jpg')
);
create index agent_workbench_runs_created_idx on public.agent_workbench_runs(created_at desc,id desc);
create index agent_workbench_runs_status_created_idx on public.agent_workbench_runs(status,created_at desc,id desc);
create index agent_workbench_runs_expiry_idx on public.agent_workbench_runs(expires_at);
-- unique(run_id,position) supplies the ordered per-run asset index.
create index agent_workbench_assets_state_created_idx on public.agent_workbench_assets(state,created_at);
alter table public.agent_workbench_runs enable row level security;
alter table public.agent_workbench_steps enable row level security;
alter table public.agent_workbench_assets enable row level security;
revoke all on public.agent_workbench_runs,public.agent_workbench_steps,public.agent_workbench_assets from public,anon,authenticated;
grant select,insert,update,delete on public.agent_workbench_runs,public.agent_workbench_steps,public.agent_workbench_assets to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('agent-workbench-test-inputs','agent-workbench-test-inputs',false,3670016,array['image/jpeg']);

create function public.agent_workbench_freeze() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if tg_table_name='agent_workbench_runs' then
    if row(new.id,new.request_id,new.parent_run_id,new.kind,new.created_at,new.expires_at,new.input_snapshot,new.input_digest,new.config_snapshot,new.config_digest)
       is distinct from row(old.id,old.request_id,old.parent_run_id,old.kind,old.created_at,old.expires_at,old.input_snapshot,old.input_digest,old.config_snapshot,old.config_digest) then
       raise exception 'IMMUTABLE_SNAPSHOT';
    end if;
    if old.status in ('succeeded','partial','failed','interrupted') and row(new.status,new.started_at,new.ended_at,new.execution_token,new.lease_expires_at,new.error,new.summary)
       is distinct from row(old.status,old.started_at,old.ended_at,old.execution_token,old.lease_expires_at,old.error,old.summary) then raise exception 'TERMINAL_RUN'; end if;
  elsif old.status in ('succeeded','failed','skipped','interrupted') and new is distinct from old then raise exception 'FROZEN_STEP';
  end if;
  return new;
end $$;
create trigger agent_workbench_runs_freeze before update on public.agent_workbench_runs for each row execute function public.agent_workbench_freeze();
create trigger agent_workbench_steps_freeze before update on public.agent_workbench_steps for each row execute function public.agent_workbench_freeze();

create function public.agent_workbench_create(p_id uuid,p_request_id uuid,p_parent_id uuid,p_input jsonb,p_input_digest text,p_config jsonb,p_config_digest text,p_assets jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.agent_workbench_runs; a jsonb; s text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,672006));
  select * into r from public.agent_workbench_runs where request_id=p_request_id;
  if found then
    if r.expires_at<=now() then raise exception 'NOT_FOUND'; end if;
    if r.input_digest<>p_input_digest or r.config_digest<>p_config_digest or r.parent_run_id is distinct from p_parent_id then raise exception 'REQUEST_CONFLICT'; end if;
    return jsonb_build_object('run',to_jsonb(r),'created',false);
  end if;
  if jsonb_typeof(p_assets)<>'array' or jsonb_array_length(p_assets) not between 1 and 9 or (p_input->>'photoCount')::integer<>jsonb_array_length(p_assets) then raise exception 'INVALID_INPUT'; end if;
  insert into public.agent_workbench_runs(id,request_id,parent_run_id,input_snapshot,input_digest,config_snapshot,config_digest)
  values(p_id,p_request_id,p_parent_id,p_input,p_input_digest,p_config,p_config_digest) returning * into r;
  for a in select value from jsonb_array_elements(p_assets) loop
    insert into public.agent_workbench_assets(id,run_id,position,storage_path,byte_size,sha256)
    values((a->>'id')::uuid,p_id,(a->>'position')::smallint,'runs/'||p_id::text||'/photos/'||(a->>'position')||'.jpg',(a->>'byte_size')::bigint,a->>'sha256');
  end loop;
  foreach s in array array['input','memory','music_profile','ai_music','qq_recommendations','summary'] loop
    insert into public.agent_workbench_steps(run_id,stage,driver) values(p_id,s,case when s='memory' then 'pi' else 'pipeline' end);
  end loop;
  return jsonb_build_object('run',to_jsonb(r),'created',true);
end $$;

create function public.agent_workbench_read(p_ids uuid[]) returns jsonb language sql security invoker set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('run',to_jsonb(r),
    'steps',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from public.agent_workbench_steps s where s.run_id=r.id),
    'assets',(select coalesce(jsonb_agg(to_jsonb(a) order by a.position),'[]') from public.agent_workbench_assets a where a.run_id=r.id))),'[]')
  from public.agent_workbench_runs r where r.id=any(p_ids) and r.expires_at>now()
$$;
create function public.agent_workbench_list(p_status text default null,p_id uuid default null,p_from timestamptz default null,p_to timestamptz default null,p_limit integer default 25,p_cursor_time timestamptz default null,p_cursor_id uuid default null)
returns setof public.agent_workbench_runs language sql security invoker set search_path='' as $$
 select * from public.agent_workbench_runs r where r.expires_at>now()
 and (p_status is null or r.status=p_status) and (p_id is null or r.id=p_id)
 and (p_from is null or r.created_at>=p_from) and (p_to is null or r.created_at<=p_to)
 and (p_cursor_time is null or (r.created_at,r.id)<(p_cursor_time,p_cursor_id))
 order by r.created_at desc,r.id desc limit least(greatest(p_limit,1),51)
$$;
create function public.agent_workbench_input_state(p_id uuid,p_position integer default null,p_error jsonb default null) returns void language plpgsql security invoker set search_path='' as $$
declare r public.agent_workbench_runs;
begin
 select * into r from public.agent_workbench_runs where id=p_id and expires_at>now() for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if r.status<>'uploading' then raise exception 'RUN_NOT_READY'; end if;
 if p_error is not null then
   update public.agent_workbench_assets set state='failed' where run_id=p_id and state='reserved';
   update public.agent_workbench_steps set status=case when stage in ('input','summary') then 'failed' else 'skipped' end,error=p_error,ended_at=now() where run_id=p_id;
   update public.agent_workbench_runs set status='failed',error=p_error,ended_at=now() where id=p_id;
 elsif p_position is not null then
   update public.agent_workbench_assets set state='ready' where run_id=p_id and position=p_position and state='reserved';
 else
   if exists(select 1 from public.agent_workbench_assets where run_id=p_id and state<>'ready') then raise exception 'RUN_NOT_READY'; end if;
   update public.agent_workbench_steps set status='succeeded',source='deterministic',result=r.input_snapshot,started_at=now(),ended_at=now() where run_id=p_id and stage='input';
   update public.agent_workbench_runs set status='queued' where id=p_id;
 end if;
end $$;
create function public.agent_workbench_claim(p_id uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.agent_workbench_runs; token uuid;
begin
 perform pg_advisory_xact_lock(672006,2);
 select * into r from public.agent_workbench_runs where id=p_id and expires_at>now() for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if r.status in ('succeeded','partial','failed','interrupted') then return jsonb_build_object('terminal',true); end if;
 if r.status='running' then raise exception 'RUN_BUSY'; end if;
 if r.status<>'queued' or exists(select 1 from public.agent_workbench_assets where run_id=p_id and state<>'ready') then raise exception 'RUN_NOT_READY'; end if;
 if (select count(*) from public.agent_workbench_runs where status='running' and expires_at>now())>=2 then raise exception 'CONCURRENCY_LIMIT'; end if;
 token:=gen_random_uuid();
 update public.agent_workbench_runs set status='running',started_at=now(),execution_token=token,lease_expires_at=now()+interval '240 seconds' where id=p_id;
 return jsonb_build_object('terminal',false,'token',token);
end $$;
create function public.agent_workbench_step(p_id uuid,p_token uuid,p_stage text,p_step jsonb) returns void language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.agent_workbench_runs where id=p_id and status='running' and execution_token=p_token and expires_at>now() and lease_expires_at>now() for update;
 if not found then raise exception 'WRITE_REJECTED'; end if;
 update public.agent_workbench_steps set status=p_step->>'status',source=p_step->>'source',
 started_at=coalesce(started_at,now()),ended_at=case when p_step->>'status'='running' then null else now() end,
 result=p_step->'result',error=nullif(p_step->'error','null'::jsonb),calls=coalesce(p_step->'calls','[]'),events=coalesce(p_step->'events','[]')
 where run_id=p_id and stage=p_stage;
 if not found then raise exception 'INVALID_STAGE'; end if;
end $$;
create function public.agent_workbench_finish(p_id uuid,p_token uuid,p_status text,p_summary jsonb,p_error jsonb default null) returns void language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.agent_workbench_runs where id=p_id and status='running' and execution_token=p_token and expires_at>now() and lease_expires_at>now() for update;
 if not found then raise exception 'WRITE_REJECTED'; end if;
 if p_status not in ('succeeded','partial','failed','interrupted') then raise exception 'INVALID_STATUS'; end if;
 update public.agent_workbench_steps set status=case when p_status='interrupted' then 'interrupted' else 'skipped' end,ended_at=now(),error=p_error where run_id=p_id and stage<>'summary' and status in ('pending','running');
 update public.agent_workbench_steps set status=case when p_status='interrupted' then 'interrupted' else 'succeeded' end,source='deterministic',started_at=now(),ended_at=now(),result=p_summary,error=p_error where run_id=p_id and stage='summary' and status='pending';
 update public.agent_workbench_runs set status=p_status,summary=p_summary,error=p_error,ended_at=now(),execution_token=null,lease_expires_at=null where id=p_id;
end $$;

revoke all on function public.agent_workbench_freeze() from public,anon,authenticated;
revoke all on function public.agent_workbench_create(uuid,uuid,uuid,jsonb,text,jsonb,text,jsonb),public.agent_workbench_read(uuid[]),public.agent_workbench_list(text,uuid,timestamptz,timestamptz,integer,timestamptz,uuid),public.agent_workbench_input_state(uuid,integer,jsonb),public.agent_workbench_claim(uuid),public.agent_workbench_step(uuid,uuid,text,jsonb),public.agent_workbench_finish(uuid,uuid,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.agent_workbench_create(uuid,uuid,uuid,jsonb,text,jsonb,text,jsonb),public.agent_workbench_read(uuid[]),public.agent_workbench_list(text,uuid,timestamptz,timestamptz,integer,timestamptz,uuid),public.agent_workbench_input_state(uuid,integer,jsonb),public.agent_workbench_claim(uuid),public.agent_workbench_step(uuid,uuid,text,jsonb),public.agent_workbench_finish(uuid,uuid,text,jsonb,jsonb) to service_role;
