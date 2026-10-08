-- Thumbnails, large previews and catalog previews in a public bucket: their paths carry random ids
-- (unguessable, never listed publicly), so they can be served from the CDN with long caching and stable
-- URLs. The full-resolution PNGs stay in the private `renders` bucket, signed when downloaded.
insert into storage.buckets (id, name, public)
values ('thumbs', 'thumbs', true)
on conflict (id) do update set public = true;

-- Project cards count their sets in the database instead of fetching every design.
create or replace function public.project_set_counts(project_ids uuid[])
returns table (project_id uuid, sets bigint)
language sql stable security definer set search_path = public as $$
  select r.project_id, count(distinct coalesce(r.set_id, r.id))
  from public.renders r
  where r.project_id = any(project_ids) and r.archived_at is null
  group by r.project_id
$$;
