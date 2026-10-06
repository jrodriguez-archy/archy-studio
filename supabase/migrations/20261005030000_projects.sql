-- Projects: folders that organise pieces. A project is shared with the team or personal (only its
-- owner sees it). A piece lives in one project or none; deleting a project keeps its pieces.

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  shared boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_owner_idx on public.projects (owner_id, name);

alter table public.renders add column if not exists project_id uuid references public.projects (id) on delete set null;
create index if not exists renders_project_idx on public.renders (project_id, created_at desc);

-- Reads follow visibility; every write goes through the server (secret key), which checks ownership.
alter table public.projects enable row level security;
create policy "Team reads shared projects and their own" on public.projects
  for select to authenticated using (shared or owner_id = (select auth.uid()));
