-- Canvas: a piece keeps its full source (template + format + slots + hand edits), so anyone on the team
-- can open it in Canvas, correct it and export it again. An edit saved as a new version points to the
-- piece it came from; one saved over the original keeps the same row.

alter table public.renders add column if not exists edits jsonb not null default '{}'::jsonb;
alter table public.renders add column if not exists variant text;
alter table public.renders add column if not exists parent_id uuid references public.renders (id) on delete set null;
alter table public.renders add column if not exists edited_at timestamptz;

-- Images people bring (photos placed in Canvas, partner logos sent inline). Private; the server signs them.
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', false)
on conflict (id) do nothing;
