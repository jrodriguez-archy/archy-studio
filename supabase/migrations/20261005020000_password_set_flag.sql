-- First sign-in creates the person's own password. A reset by an admin clears the flag so the
-- next sign-in asks for a new one.
alter table public.profiles add column if not exists password_set boolean not null default false;

update public.profiles p
set is_admin = a.is_admin
from public.allowed_emails a
where a.email = p.email;
