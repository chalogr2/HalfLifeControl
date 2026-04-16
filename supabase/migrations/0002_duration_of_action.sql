-- Add duration_of_action_minutes to pills and doses.
--
-- Snapshotted on each pill/dose at creation time so future curated DB updates
-- don't retroactively change historical countdowns. Nullable: null means
-- "no curated value yet — fall back to 2 × half_life_minutes multiplier in code."

alter table public.pills
  add column if not exists duration_of_action_minutes integer
    check (duration_of_action_minutes is null or duration_of_action_minutes > 0);

alter table public.doses
  add column if not exists duration_of_action_minutes integer
    check (duration_of_action_minutes is null or duration_of_action_minutes > 0);

comment on column public.pills.duration_of_action_minutes is
  'Snapshot of curated duration of action at pill creation. null = use 2× half_life fallback. See docs/SOURCES.md.';
comment on column public.doses.duration_of_action_minutes is
  'Snapshot of duration of action at dose creation. null = use 2× half_life fallback.';
