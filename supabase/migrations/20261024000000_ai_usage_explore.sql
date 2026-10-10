-- Images Claude generates for explorations (generate_image) have their own daily limit.
alter table public.ai_usage drop constraint if exists ai_usage_kind_check;
alter table public.ai_usage add constraint ai_usage_kind_check check (kind in ('generate', 'cutout', 'outpaint', 'explore'));
