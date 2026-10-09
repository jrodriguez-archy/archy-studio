-- The Gallery's "Get started" card, per person: when they first opened a design in Canvas, when they
-- closed the card, and when they saw it complete (then it never shows again).
alter table public.profiles add column if not exists onboarding jsonb not null default '{}'::jsonb;
