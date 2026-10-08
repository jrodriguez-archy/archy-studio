-- Folders for the team's images (Canvas → Assets), one level, shared like a team drive. Removing a
-- folder keeps its images: they go back to no folder.
create table if not exists public.asset_folders (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 60),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists asset_folders_name on public.asset_folders (lower(name));
alter table public.asset_folders enable row level security;
drop policy if exists "Team can read asset folders" on public.asset_folders;
create policy "Team can read asset folders" on public.asset_folders for select to authenticated using (true);

alter table public.assets add column if not exists folder_id uuid references public.asset_folders(id) on delete set null;
create index if not exists assets_folder on public.assets (folder_id, created_at desc) where deleted_at is null;
