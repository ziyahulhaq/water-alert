-- ============================================================
-- AquaFlow Admin Panel — Database Migrations
-- Run this entire file in Supabase SQL Editor ONCE.
-- After running: SELECT seed_default_admin();
-- ============================================================

-- ─── 1. Extend profiles table ────────────────────────────────
alter table public.profiles
  add column if not exists name       text,
  add column if not exists role       text not null default 'user',
  add column if not exists status     text not null default 'active',
  add column if not exists email      text;

-- Backfill email from auth.users where missing
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null;

-- ─── 2. Models table ─────────────────────────────────────────
create table if not exists public.models (
  id          uuid primary key default gen_random_uuid(),
  model_id    text unique not null,
  device_name text not null,
  description text,
  status      text not null default 'active',
  created_at  timestamptz default now() not null
);

-- ─── 3. Audit logs table ─────────────────────────────────────
create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  action      text not null,
  actor_id    uuid references auth.users(id) on delete set null,
  actor_email text,
  target_id   text,
  target_type text,
  details     jsonb,
  created_at  timestamptz default now() not null
);

-- ─── 4. App settings table ───────────────────────────────────
create table if not exists public.app_settings (
  key   text primary key,
  value text,
  updated_at timestamptz default now()
);

insert into public.app_settings (key, value)
values
  ('app_name', 'AquaFlow'),
  ('maintenance_mode', 'false'),
  ('whatsapp_enabled', 'false')
on conflict (key) do nothing;

-- ─── 5. Helper: is_admin() ───────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ─── 6. RLS — profiles ───────────────────────────────────────
alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile"        on public.profiles;
drop policy if exists "Users can update own profile"      on public.profiles;
drop policy if exists "Admins can view all profiles"      on public.profiles;
drop policy if exists "Admins can update all profiles"    on public.profiles;
drop policy if exists "Admins can insert profiles"        on public.profiles;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id or public.is_admin());

create policy "Admins can insert profiles"
  on public.profiles for insert
  with check (public.is_admin() or auth.uid() = id);

create policy "Admins can delete profiles"
  on public.profiles for delete
  using (public.is_admin());

-- ─── 7. RLS — models ─────────────────────────────────────────
alter table public.models enable row level security;

drop policy if exists "Admins full access models" on public.models;
drop policy if exists "Users can read models"     on public.models;

create policy "Admins full access models"
  on public.models for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "Users can read models"
  on public.models for select
  using (auth.role() = 'authenticated');

-- ─── 8. RLS — audit_logs ─────────────────────────────────────
alter table public.audit_logs enable row level security;

drop policy if exists "Admins full access audit_logs" on public.audit_logs;

create policy "Admins full access audit_logs"
  on public.audit_logs for all
  using (public.is_admin())
  with check (public.is_admin());

-- ─── 9. RLS — app_settings ───────────────────────────────────
alter table public.app_settings enable row level security;

drop policy if exists "Admins full access settings" on public.app_settings;
drop policy if exists "Authenticated can read settings" on public.app_settings;

create policy "Admins full access settings"
  on public.app_settings for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "Authenticated can read settings"
  on public.app_settings for select
  using (auth.role() = 'authenticated');

-- ─── 10. Seed default Super Admin ────────────────────────────
-- Call: SELECT seed_default_admin();
create or replace function public.seed_default_admin()
returns text
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_existing uuid;
begin
  -- Check if already exists
  select id into v_existing from auth.users where email = 'admin123@gmail.com';

  if v_existing is not null then
    -- Ensure profile has admin role
    insert into public.profiles (id, email, name, role, status)
    values (v_existing, 'admin123@gmail.com', 'Super Admin', 'admin', 'active')
    on conflict (id) do update
      set role = 'admin', status = 'active', name = 'Super Admin', email = 'admin123@gmail.com';
    return 'Admin already exists — role enforced: ' || v_existing::text;
  end if;

  -- Create in auth.users
  v_user_id := gen_random_uuid();

  insert into auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, role, aud, created_at, updated_at,
    confirmation_token, recovery_token, is_super_admin
  ) values (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'admin123@gmail.com',
    crypt('admin123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Super Admin"}',
    'authenticated',
    'authenticated',
    now(),
    now(),
    '',
    '',
    false
  );

  -- Create profile with admin role
  insert into public.profiles (id, email, name, role, status)
  values (v_user_id, 'admin123@gmail.com', 'Super Admin', 'admin', 'active')
  on conflict (id) do update
    set role = 'admin', status = 'active', name = 'Super Admin';

  return 'Super Admin created: ' || v_user_id::text;
end;
$$;

-- ─── 11. Trigger: auto-create profile on signup ──────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, email, name, role, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    'user',
    'active'
  )
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── 12. View: devices with user info ────────────────────────
create or replace view public.admin_devices_view as
select
  d.id,
  d.mac_id,
  d.status,
  d.last_seen,
  p.email as user_email,
  p.name  as user_name,
  p.id    as user_id
from public.devices d
left join public.user_device ud on ud.device_id = d.id
left join public.profiles p on p.id = ud.user_id;

-- ─── Done ────────────────────────────────────────────────────
-- After running this file, execute:
--   SELECT seed_default_admin();
-- ─────────────────────────────────────────────────────────────
