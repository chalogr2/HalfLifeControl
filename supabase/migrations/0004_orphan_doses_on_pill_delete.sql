-- Preserve dose history when a pill row is hard-deleted.
--
-- Up until now, doses.pill_id had ON DELETE CASCADE, so hard-deleting a pill
-- (the lifecycle path for one-time tracking pills once their elimination
-- clears) wiped the dose history too. The dose row carries denormalized
-- drug_name and timestamp snapshots, so a NULL pill_id is enough to render
-- the dose in History without depending on the pills table.
--
-- This migration relaxes the FK to ON DELETE SET NULL and makes pill_id
-- nullable so a deleted pill's doses remain queryable as orphan history.

alter table public.doses drop constraint doses_pill_id_fkey;

alter table public.doses alter column pill_id drop not null;

alter table public.doses
  add constraint doses_pill_id_fkey
  foreign key (pill_id)
  references public.pills(id)
  on delete set null;

comment on column public.doses.pill_id is
  'Owning pill. SET NULL on pill hard-delete so dose history survives for orphan one-off pills; render falls back to drug_name + the current pill_id lookup.';

-- Reload PostgREST schema cache so the constraint change is picked up.
notify pgrst, 'reload schema';
