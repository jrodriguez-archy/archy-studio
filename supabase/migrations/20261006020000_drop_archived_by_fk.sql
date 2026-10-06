-- archived_by keeps who archived a set, without a second renders→profiles relationship: with two,
-- PostgREST cannot tell which one `profiles(...)` means and the gallery query fails.
alter table public.renders drop constraint if exists renders_archived_by_fkey;
