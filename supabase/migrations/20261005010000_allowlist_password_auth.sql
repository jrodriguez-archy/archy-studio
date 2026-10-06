-- Password sign-in without email: only addresses on the team allowlist can have an account.
-- Accounts are created by the server after checking the list (public sign-ups are off).

create table if not exists public.allowed_emails (
  email text primary key check (email = lower(email) and email like '%@archy.com'),
  is_admin boolean not null default false,
  added_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.allowed_emails enable row level security; -- server (secret key) only

insert into public.allowed_emails (email, is_admin)
values ('jrodriguez@archy.com', true)
on conflict (email) do update set is_admin = true;

alter table public.profiles add column if not exists is_admin boolean not null default false;

-- Replace the domain-only guard: the address must be on the allowlist.
create or replace function public.enforce_archy_domain()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null or not exists (select 1 from public.allowed_emails a where a.email = lower(new.email)) then
    raise exception 'This email is not on the Archy Studio team list';
  end if;
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, is_admin)
  values (
    new.id, lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce((select a.is_admin from public.allowed_emails a where a.email = lower(new.email)), false)
  );
  return new;
end;
$$;
