-- The gallery and Canvas's Library follow new designs, new versions and replaced images live.
-- The team already reads renders (RLS); Realtime only needs the table in the publication.
alter publication supabase_realtime add table public.renders;
