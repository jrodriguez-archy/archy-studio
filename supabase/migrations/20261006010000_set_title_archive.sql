-- Sets can be renamed and archived. Archived sets leave the gallery; from the Archive page the people
-- who own them (creator, project owner, admins) restore or delete them for good.

alter table public.renders add column if not exists set_title text check (set_title is null or char_length(btrim(set_title)) between 1 and 120);
alter table public.renders add column if not exists archived_at timestamptz;
alter table public.renders add column if not exists archived_by uuid references public.profiles (id) on delete set null;

create index if not exists renders_live_idx on public.renders (created_at desc) where archived_at is null;
create index if not exists renders_archived_idx on public.renders (archived_at desc) where archived_at is not null;
