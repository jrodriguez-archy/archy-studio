-- Sets: every piece made from one brief (all its formats, retries and options) shares a set_id,
-- so the gallery shows them stacked as one card.

alter table public.renders add column if not exists set_id uuid;
create index if not exists renders_set_idx on public.renders (set_id, created_at);

-- Backfill: pieces by the same person and template made less than 3 minutes apart form one set.
with ordered as (
  select id, user_id, template, created_at,
    case
      when lag(created_at) over w is null
        or lag(user_id) over w is distinct from user_id
        or lag(template) over w is distinct from template
        or created_at - lag(created_at) over w > interval '3 minutes'
      then 1 else 0
    end as cut
  from public.renders
  where set_id is null
  window w as (order by user_id nulls first, template, created_at)
),
grouped as (
  select id, sum(cut) over (order by user_id nulls first, template, created_at rows unbounded preceding) as grp
  from ordered
),
ids as (
  select grp, gen_random_uuid() as set_id from grouped group by grp
)
update public.renders r
set set_id = ids.set_id
from grouped g join ids using (grp)
where r.id = g.id;
