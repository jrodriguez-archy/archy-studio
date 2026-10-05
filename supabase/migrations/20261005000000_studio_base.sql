-- Archy Studio: team-only accounts, profiles, and the shared gallery of renders.

-- Only @archy.com addresses can create an account (works on every plan, no auth hook needed).
create or replace function public.enforce_archy_domain()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null or lower(split_part(new.email, '@', 2)) <> 'archy.com' then
    raise exception 'Archy Studio is only available to @archy.com accounts';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_archy_domain on auth.users;
create trigger enforce_archy_domain
  before insert on auth.users
  for each row execute function public.enforce_archy_domain();

-- Profiles, created with the account.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
create policy "Team can read profiles" on public.profiles
  for select to authenticated using (true);
create policy "Users update their own profile" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Renders: every finished piece, visible to the whole team. Only the server writes them.
create table if not exists public.renders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  template text not null,
  format text not null,
  slots jsonb not null default '{}'::jsonb,
  storage_path text not null,
  width int not null,
  height int not null,
  scale int not null default 2,
  source text not null default 'mcp',
  created_at timestamptz not null default now()
);

create index if not exists renders_created_at_idx on public.renders (created_at desc);
create index if not exists renders_user_idx on public.renders (user_id, created_at desc);
create index if not exists renders_template_idx on public.renders (template, created_at desc);

alter table public.renders enable row level security;
create policy "Team can read renders" on public.renders
  for select to authenticated using (true);

-- Storage: private bucket for the PNGs (served with signed URLs) and catalog previews.
insert into storage.buckets (id, name, public)
values ('renders', 'renders', false)
on conflict (id) do nothing;

create policy "Team can read render files" on storage.objects
  for select to authenticated using (bucket_id = 'renders');
