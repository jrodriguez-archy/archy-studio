-- Canvas drafts: the work in progress on a piece (copy, hand edits), saved as people edit and shared
-- with Claude. Claude edits a draft through the MCP tools; Canvas, open on that piece, receives the
-- change live (Realtime) and shows it as one more step it can undo. Saving the piece clears the draft.

create table if not exists public.canvas_drafts (
  piece_id uuid primary key references public.renders (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  slots jsonb not null default '{}'::jsonb,
  edits jsonb not null default '{}'::jsonb,
  version int not null default 0,
  updated_by text not null default 'app' check (updated_by in ('app', 'claude')),
  note text,
  updated_at timestamptz not null default now()
);

create index if not exists canvas_drafts_user_idx on public.canvas_drafts (user_id, updated_at desc);

-- The team reads drafts (Realtime needs it); only the server writes them.
alter table public.canvas_drafts enable row level security;
create policy "Team can read canvas drafts" on public.canvas_drafts
  for select to authenticated using (true);

alter publication supabase_realtime add table public.canvas_drafts;
