-- Paid AI calls (generate, edit with AI, remove background), counted when they start: the daily limits
-- hold even for attempts that fail or run in parallel. Written by the server only.
create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('generate', 'cutout')),
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_recent on public.ai_usage (user_id, kind, created_at desc);
alter table public.ai_usage enable row level security;
