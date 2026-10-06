-- When each person last used the Archy Studio connector from their Claude, so Canvas can tell them
-- whether Claude is connected.
alter table public.profiles add column if not exists mcp_seen_at timestamptz;
