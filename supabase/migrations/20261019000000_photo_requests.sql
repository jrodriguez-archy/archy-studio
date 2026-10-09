-- Photo requests: Claude asks for the photos a design needs with a link; the person drops them on a small
-- Studio page, they join Assets (in the design's brand) and Claude picks them up. One request holds every
-- photo the design is missing (three speakers, one link). Links expire; only the server reads this table.
create table if not exists public.photo_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  brand text not null default 'archy' check (brand in ('archy', 'doc')),
  template text,
  -- [{ key, label, slot, cutout, asset_id }]
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '1 hour'
);
alter table public.photo_requests enable row level security;
