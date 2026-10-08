-- Without ids: every project's count, so the app asks for projects and counts at the same time.
-- Only the server (service role) calls it.
create or replace function public.project_set_counts(project_ids uuid[] default null)
returns table (project_id uuid, sets bigint)
language sql stable security definer set search_path = public as $$
  select r.project_id, count(distinct coalesce(r.set_id, r.id))
  from public.renders r
  where r.project_id is not null and (project_ids is null or r.project_id = any(project_ids)) and r.archived_at is null
  group by r.project_id
$$;
revoke execute on function public.project_set_counts(uuid[]) from public, anon, authenticated;
