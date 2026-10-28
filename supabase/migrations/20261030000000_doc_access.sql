-- DOC is shown only to the people an admin turns it on for (Admin › Team). Everyone else sees Archy
-- alone: no brand switcher, no DOC in the Docs, and the MCP refuses DOC.
alter table public.allowed_emails add column if not exists doc_access boolean not null default false;
update public.allowed_emails set doc_access = true where email = 'jrodriguez@archy.com';
