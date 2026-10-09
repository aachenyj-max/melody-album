create table public.creation_drafts (
  id uuid primary key default gen_random_uuid(),
  owner_key text not null,
  request_id uuid not null,
  revision integer not null default 0 check (revision >= 0),
  config jsonb not null,
  dialogue_config jsonb not null,
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  unique (owner_key, request_id)
);
create index creation_drafts_expiry_idx on public.creation_drafts (expires_at);
alter table public.creation_drafts enable row level security;
revoke all on public.creation_drafts from anon, authenticated;
grant all on public.creation_drafts to service_role;

-- All writes are service-only CAS transactions. No model/network work holds this lock.
create function public.creation_draft_commit(p_id uuid, p_owner text, p_revision integer, p_state jsonb, p_touch boolean default true)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare old_row public.creation_drafts; result public.creation_drafts;
begin
  select * into old_row from public.creation_drafts
    where id = p_id and owner_key = p_owner and expires_at > now() for update;
  if not found or old_row.revision <> p_revision then raise exception 'CONFLICT'; end if;
  if pg_catalog.octet_length(p_state::text) > 2097152 then raise exception 'CAPACITY'; end if;
  if jsonb_typeof(p_state->'messages') <> 'array' or jsonb_typeof(p_state->'snapshots') <> 'array'
     or jsonb_array_length(p_state->'messages') < jsonb_array_length(old_row.state->'messages')
     or jsonb_array_length(p_state->'snapshots') < jsonb_array_length(old_row.state->'snapshots') then raise exception 'INVALID_STATE'; end if;
  if exists (select 1 from jsonb_array_elements(old_row.state->'messages') with ordinality x(item,n)
     where p_state->'messages'->((x.n-1)::integer) is distinct from x.item)
     or exists (select 1 from jsonb_array_elements(old_row.state->'snapshots') with ordinality x(item,n)
     where p_state->'snapshots'->((x.n-1)::integer) is distinct from x.item)
     or exists (select 1 from jsonb_array_elements(old_row.state->'cards') with ordinality x(item,n)
     where (p_state->'cards'->((x.n-1)::integer) - 'status') is distinct from (x.item - 'status')) then raise exception 'APPEND_ONLY'; end if;
  update public.creation_drafts set state = p_state, revision = revision+1,
    updated_at = case when p_touch then now() else updated_at end,
    expires_at = case when p_touch then now()+interval '30 days' else expires_at end
    where id = p_id returning * into result;
  return to_jsonb(result);
end $$;
revoke all on function public.creation_draft_commit(uuid,text,integer,jsonb,boolean) from public, anon, authenticated;
grant execute on function public.creation_draft_commit(uuid,text,integer,jsonb,boolean) to service_role;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('creation-photos','creation-photos',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
