-- Template proposals: anyone on the team proposes an exploration (a design made outside the templates)
-- as a future template; admins see them in their own gallery (Admin › Template proposals) and move them
-- along. One open proposal per set. Only the server reads this table.
create table if not exists public.template_proposals (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null,
  render_id uuid references public.renders(id) on delete set null,
  brand text not null default 'archy' check (brand in ('archy', 'doc')),
  proposed_by uuid references public.profiles(id) on delete set null,
  note text,
  status text not null default 'proposed' check (status in ('proposed', 'in-progress', 'done', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists template_proposals_set on public.template_proposals (set_id);
create index if not exists template_proposals_status on public.template_proposals (status, created_at desc);
alter table public.template_proposals enable row level security;
