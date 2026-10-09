-- Two brands in one Studio: Archy (default) and DOC (Dental Ownership Collective). Designs, projects,
-- images and image folders each belong to one brand and are only shown in that brand. Everything made
-- so far is Archy's.
alter table public.renders add column if not exists brand text not null default 'archy' check (brand in ('archy', 'doc'));
alter table public.projects add column if not exists brand text not null default 'archy' check (brand in ('archy', 'doc'));
alter table public.assets add column if not exists brand text not null default 'archy' check (brand in ('archy', 'doc'));
alter table public.asset_folders add column if not exists brand text not null default 'archy' check (brand in ('archy', 'doc'));

create index if not exists renders_brand_created on public.renders (brand, created_at desc);
create index if not exists assets_brand_created on public.assets (brand, created_at desc) where deleted_at is null;

-- A folder name is unique within its brand (DOC and Archy can both have "Headshots").
drop index if exists public.asset_folders_name;
create unique index if not exists asset_folders_brand_name on public.asset_folders (brand, lower(name));
