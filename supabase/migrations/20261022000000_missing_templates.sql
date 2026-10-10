-- Missing templates: briefs no template fits (a kind of piece or a format the catalog does not have yet),
-- kept by Claude so Marketing & Design see which templates are asked for most. Only the server reads it.
create table if not exists public.missing_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  brand text not null default 'archy' check (brand in ('archy', 'doc')),
  -- What was asked for, in a few words ("LinkedIn banner for a webinar"), and the size when there is one.
  piece text not null,
  format text,
  -- The facts the brief brought and its purpose, as match_templates names them.
  facts text[] not null default '{}',
  purpose text,
  -- The closest templates offered, and why they did not do.
  offered text[] not null default '{}',
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists missing_templates_created_at on public.missing_templates (created_at desc);
alter table public.missing_templates enable row level security;
