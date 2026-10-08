-- How many images each Assets folder holds, counted in the database (any number of images).
create or replace function public.asset_folder_counts()
returns table (folder_id uuid, images bigint)
language sql stable security definer set search_path = public as $$
  select a.folder_id, count(*) from public.assets a
  where a.folder_id is not null and a.deleted_at is null
  group by a.folder_id
$$;
revoke execute on function public.asset_folder_counts() from public, anon, authenticated;
