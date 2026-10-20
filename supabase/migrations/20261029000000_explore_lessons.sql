-- Lessons from review: what Juan teaches explorations, written as principles (never pixel values).
-- Claude proposes them from review comments and Canvas corrections; an admin approves them, and every
-- approved lesson of a brand goes out with get_brand_kit from then on. Only the server reads this table.
create table if not exists public.explore_lessons (
  id uuid primary key default gen_random_uuid(),
  brand text not null default 'archy' check (brand in ('archy', 'doc')),
  title text not null check (char_length(btrim(title)) between 3 and 120),
  -- The principle and why, in a few sentences.
  body text not null check (char_length(btrim(body)) between 10 and 1200),
  -- When it applies, in plain words ("copy-led piece", "photo with a person", "pricing").
  applies_when text,
  -- Renders that show it: { before, after } ids, before the correction and after it.
  examples jsonb not null default '[]'::jsonb,
  source text,
  status text not null default 'proposed' check (status in ('proposed', 'approved', 'retired')),
  created_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists explore_lessons_status on public.explore_lessons (brand, status, created_at desc);
alter table public.explore_lessons enable row level security;
