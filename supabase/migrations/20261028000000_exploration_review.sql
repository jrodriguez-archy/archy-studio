-- Exploration review: the same board as Template review, for the team's explorations. A round of kind
-- 'exploration' points at existing renders (no new image): the newest of each format in each set. A
-- Canvas version an admin saves of a reviewed exploration (a child render, parent_id) shows as its "after".

alter table public.review_rounds add column if not exists kind text not null default 'template'
  check (kind in ('template', 'exploration'));
alter table public.review_items add column if not exists kind text not null default 'template'
  check (kind in ('template', 'exploration'));
alter table public.review_items add column if not exists render_id uuid references public.renders (id) on delete set null;

-- Round numbers count per kind (Round 1 of explorations next to Round 12 of templates).
alter table public.review_rounds drop constraint if exists review_rounds_number_key;
create unique index if not exists review_rounds_kind_number on public.review_rounds (kind, number);
create index if not exists review_items_render_idx on public.review_items (render_id) where render_id is not null;
