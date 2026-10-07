-- Template review: rounds of example designs (every template × format × case) that an admin evaluates
-- in Studio (Admin → Template review). Comments point at a spot on the image; Claude resolves them by
-- fixing the engine, a template's rules or the template in Paper, and the next round shows before/after.
-- Admins read; only the server writes.

create table if not exists public.review_rounds (
  id uuid primary key default gen_random_uuid(),
  number int not null unique,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.review_items (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.review_rounds (id) on delete cascade,
  template text not null,
  format text not null,
  -- realistic | short | long | theme:<preset>
  "case" text not null,
  slots jsonb not null default '{}',
  edits jsonb not null default '{}',
  storage_path text not null,
  width int not null,
  height int not null,
  report jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'approved', 'needs_work')),
  -- The same template, format and case in the round before (before/after).
  prev_item_id uuid references public.review_items (id) on delete set null,
  -- Fingerprint of the render inputs and engine: an approved item whose fingerprint did not change is
  -- carried over as approved.
  fingerprint text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists review_items_round_idx on public.review_items (round_id, template, format, "case");

create table if not exists public.review_comments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.review_items (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  body text not null,
  -- A spot on the image (0–1), or null for a general comment.
  x real,
  y real,
  resolved_at timestamptz,
  -- What changed because of it ("fit.js: no word alone on a line", "Paper: needs a no-logo variant").
  resolution text,
  created_at timestamptz not null default now()
);
create index if not exists review_comments_item_idx on public.review_comments (item_id, created_at);

alter table public.review_rounds enable row level security;
alter table public.review_items enable row level security;
alter table public.review_comments enable row level security;

create policy "Admins read review rounds" on public.review_rounds for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
create policy "Admins read review items" on public.review_items for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
create policy "Admins read review comments" on public.review_comments for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
