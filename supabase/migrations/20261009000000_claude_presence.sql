-- Claude's presence on a Canvas draft: when it started working and what it is doing, so the open
-- Canvas shows it live (like a collaborator on the artboard). Cleared when its edit lands.
alter table public.canvas_drafts add column if not exists claude_working_at timestamptz;
alter table public.canvas_drafts add column if not exists claude_status text;
