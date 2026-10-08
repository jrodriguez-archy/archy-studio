-- "Smaller text": the requester chose to keep copy as written with the type reduced (down to 70%, never
-- under 14px) instead of shortening it. The piece remembers it so Canvas and re-renders draw it the same.

alter table public.renders add column if not exists smaller_text boolean not null default false;
