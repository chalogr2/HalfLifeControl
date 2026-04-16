-- Add duration_type, is_maintenance_interval, requires_weekly_warning to pills and doses.
--
-- duration_type classifies what the third timer represents:
--   'action'   → pharmacodynamic duration of action
--   'interval' → labelled/maintenance dosing interval
--   'none'     → no citable value (PRN / OTC / supplement); UI hides the third timer
--
-- Snapshotted per pill/dose so future curated-DB changes don't retroactively
-- shift historical timers or labels.

alter table public.pills
  add column if not exists duration_type text
    default 'action'
    check (duration_type in ('action', 'interval', 'none'));

alter table public.pills
  add column if not exists is_maintenance_interval boolean default false;

alter table public.pills
  add column if not exists requires_weekly_warning boolean default false;

alter table public.doses
  add column if not exists duration_type text
    default 'action'
    check (duration_type in ('action', 'interval', 'none'));

alter table public.doses
  add column if not exists is_maintenance_interval boolean default false;

alter table public.doses
  add column if not exists requires_weekly_warning boolean default false;

comment on column public.pills.duration_type is
  'Third-timer semantics: action | interval | none. See docs/DRUGS.md.';
comment on column public.pills.requires_weekly_warning is
  'Safety flag for weekly-dosed drugs (e.g. methotrexate) — daily dosing is lethal.';
comment on column public.doses.duration_type is
  'Snapshot of duration_type at dose creation time.';

-- Reload PostgREST schema cache so new columns are immediately queryable.
notify pgrst, 'reload schema';
