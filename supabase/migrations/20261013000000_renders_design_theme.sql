-- Templates that offer several designs (layouts) and themes (colour treatments): a piece remembers the
-- ones it was drawn with, so Canvas and re-renders open the same artboard. Null on single-design templates
-- (and on pieces made before this), which means the template's default.

alter table public.renders add column if not exists design text;
alter table public.renders add column if not exists theme text;
