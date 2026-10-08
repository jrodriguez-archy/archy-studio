-- Assets: the images the team brings to Studio (uploads), and what Studio makes from them (a cutout
-- without background, a pixel effect, a generated image). Shared with the whole team. The file lives in
-- the private `uploads` bucket (a design keeps `upload:<path>`); its light thumbnail in the public
-- `thumbs` bucket under an unguessable path.
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete set null,
  path text not null unique,
  name text not null default 'Image',
  kind text not null default 'upload' check (kind in ('upload', 'cutout', 'pixel', 'generated')),
  parent_id uuid references public.assets(id) on delete set null,
  prompt text,
  width int,
  height int,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists assets_recent on public.assets (created_at desc) where deleted_at is null;
create index if not exists assets_owner on public.assets (owner_id, created_at desc) where deleted_at is null;

alter table public.assets enable row level security;
create policy "Team can read assets" on public.assets for select to authenticated using (true);
