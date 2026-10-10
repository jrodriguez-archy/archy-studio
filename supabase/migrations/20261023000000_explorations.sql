-- Explorations: designs Claude composes in the brand kit for briefs no template covers (template
-- 'exploration'). The record keeps the HTML Claude wrote, so the design can be drawn again.
alter table public.renders add column if not exists html text;
