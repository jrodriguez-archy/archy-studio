-- The design each person has open in Canvas right now (the active artboard, refreshed every minute while
-- the tab is visible): what Claude edits when the person says "the design I have open". Written by the
-- server only.
alter table public.profiles add column if not exists canvas_piece uuid;
alter table public.profiles add column if not exists canvas_seen_at timestamptz;
