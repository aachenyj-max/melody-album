create or replace function public.creation_draft_commit(p_id uuid, p_owner text, p_revision integer, p_state jsonb, p_touch boolean default true)
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
     where ((p_state->'cards'->((x.n-1)::integer)) - 'status') is distinct from (x.item - 'status')) then raise exception 'APPEND_ONLY'; end if;
  update public.creation_drafts set state = p_state, revision = revision+1,
    updated_at = case when p_touch then now() else updated_at end,
    expires_at = case when p_touch then now()+interval '30 days' else expires_at end
    where id = p_id returning * into result;
  return to_jsonb(result);
end $$;
