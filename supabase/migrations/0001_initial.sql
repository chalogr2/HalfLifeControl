-- =========================================================================
-- HalfLifeControl initial schema
-- =========================================================================

-- Extensions
create extension if not exists "pgcrypto";   -- for gen_random_uuid()

-- -------------------------------------------------------------------------
-- profiles: 1:1 with auth.users, created by trigger on signup
-- -------------------------------------------------------------------------
create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  email               text not null,
  display_name        text,
  onboarding_complete boolean not null default false,
  subscription_tier   text not null default 'free'
                      check (subscription_tier in ('free','pro')),
  notification_token  text,
  settings            jsonb not null default
                      '{"notificationsEnabled":true,"autoAssumeTaken":false,"reminderMode":"auto_start"}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- -------------------------------------------------------------------------
-- pills
-- -------------------------------------------------------------------------
create table public.pills (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  drug_name          text not null,
  drug_id            text,
  half_life_minutes  integer not null check (half_life_minutes > 0),
  half_life_source   text not null default 'manual'
                     check (half_life_source in ('curated','openfda','manual','pubchem')),
  dosage_mg          numeric not null check (dosage_mg > 0),
  dosage_unit        text not null default 'mg',
  pill_type          text not null check (pill_type in ('scheduled','random')),
  schedule           jsonb,                -- null for random pills
  color              text not null default '#004d64',
  preferred_timer    text not null default 'clearance'
                     check (preferred_timer in ('action','halfLife','clearance')),
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index pills_user_active_idx on public.pills (user_id, is_active);

-- -------------------------------------------------------------------------
-- doses (one row per recorded dose, active + history combined)
-- -------------------------------------------------------------------------
create table public.doses (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  pill_id            uuid not null references public.pills(id) on delete cascade,
  drug_name          text not null,        -- denormalized for history display
  taken_at           timestamptz not null,
  scheduled_for      timestamptz,
  half_life_minutes  integer not null,     -- snapshotted at dose time
  elimination_at     timestamptz not null, -- precomputed: taken_at + 5 * half_life
  status             text not null default 'active'
                     check (status in ('active','dismissed','completed')),
  source             text not null default 'manual'
                     check (source in ('manual','notification','auto','retroactive')),
  created_at         timestamptz not null default now()
);

create index doses_user_status_idx on public.doses (user_id, status);
create index doses_user_taken_idx  on public.doses (user_id, taken_at desc);
create index doses_pill_idx        on public.doses (pill_id);

-- -------------------------------------------------------------------------
-- Row Level Security
-- -------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.pills    enable row level security;
alter table public.doses    enable row level security;

create policy "profiles_own" on public.profiles
  for all
  using      (auth.uid() = id)
  with check (auth.uid() = id);

create policy "pills_own" on public.pills
  for all
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "doses_own" on public.doses
  for all
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- -------------------------------------------------------------------------
-- Auto-create profile row on signup
-- -------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data->>'display_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -------------------------------------------------------------------------
-- updated_at maintenance
-- -------------------------------------------------------------------------
create function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

create trigger pills_touch
  before update on public.pills
  for each row execute function public.touch_updated_at();
