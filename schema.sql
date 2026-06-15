-- Database Schema Setup for Smart Municipal Water Supply Monitoring System
-- Run this in your Supabase SQL Editor.

-- Create profiles table
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create devices table
create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  mac_id text unique not null,
  status text not null default 'offline',
  last_seen timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create water events table
create table if not exists public.water_events (
  id uuid primary key default gen_random_uuid(),
  device_id uuid references public.devices(id) on delete cascade not null,
  detected_at timestamp with time zone default timezone('utc'::text, now()) not null,
  water_level numeric not null -- 0 for not available, 1 for available
);

-- Create notification settings table
create table if not exists public.notification_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null unique,
  whatsapp_number text default '' not null,
  enabled boolean default false not null
);

-- Create user_device junction table to allow multiple users to share a single device
create table if not exists public.user_device (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  device_id uuid references public.devices(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, device_id)
);

-- Enable Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.devices enable row level security;
alter table public.water_events enable row level security;
alter table public.notification_settings enable row level security;
alter table public.user_device enable row level security;

-- Drop existing policies if they exist (to allow reruns of the script)
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can view own devices" on public.devices;
drop policy if exists "Users can insert own devices" on public.devices;
drop policy if exists "Users can update own devices" on public.devices;
drop policy if exists "Users can view linked devices" on public.devices;
drop policy if exists "Users can insert devices" on public.devices;
drop policy if exists "Users can update linked devices" on public.devices;
drop policy if exists "Users can view own device water events" on public.water_events;
drop policy if exists "Users can insert own device water events" on public.water_events;
drop policy if exists "Users can view linked device water events" on public.water_events;
drop policy if exists "Users can insert water events for linked devices" on public.water_events;
drop policy if exists "Users can view own notification settings" on public.notification_settings;
drop policy if exists "Users can insert own notification settings" on public.notification_settings;
drop policy if exists "Users can update own notification settings" on public.notification_settings;
drop policy if exists "Users can view own device links" on public.user_device;
drop policy if exists "Users can insert own device links" on public.user_device;
drop policy if exists "Users can delete own device links" on public.user_device;

-- Policies for Profiles
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Policies for Devices (linked via user_device table)
create policy "Users can view linked devices" on public.devices
  for select using (
    exists (
      select 1 from public.user_device
      where public.user_device.device_id = public.devices.id
      and public.user_device.user_id = auth.uid()
    )
  );
create policy "Users can insert devices" on public.devices
  for insert with check (true);
create policy "Users can update linked devices" on public.devices
  for update using (
    exists (
      select 1 from public.user_device
      where public.user_device.device_id = public.devices.id
      and public.user_device.user_id = auth.uid()
    )
  );

-- Policies for Water Events
create policy "Users can view linked device water events" on public.water_events
  for select using (
    exists (
      select 1 from public.user_device
      where public.user_device.device_id = public.water_events.device_id
      and public.user_device.user_id = auth.uid()
    )
  );
create policy "Users can insert water events for linked devices" on public.water_events
  for insert with check (
    exists (
      select 1 from public.user_device
      where public.user_device.device_id = public.water_events.device_id
      and public.user_device.user_id = auth.uid()
    )
  );

-- Policies for Notification Settings
create policy "Users can view own notification settings" on public.notification_settings
  for select using (auth.uid() = user_id);
create policy "Users can insert own notification settings" on public.notification_settings
  for insert with check (auth.uid() = user_id);
create policy "Users can update own notification settings" on public.notification_settings
  for update using (auth.uid() = user_id);

-- Policies for user_device Junction Table
create policy "Users can view own device links" on public.user_device
  for select using (auth.uid() = user_id);
create policy "Users can insert own device links" on public.user_device
  for insert with check (auth.uid() = user_id);
create policy "Users can delete own device links" on public.user_device
  for delete using (auth.uid() = user_id);

-- Trigger to automatically create a profile and default notification settings upon new auth user registration
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  
  insert into public.notification_settings (user_id, whatsapp_number, enabled)
  values (new.id, '', false);
  
  return new;
end;
$$ language plpgsql security definer;

-- Recreate trigger safely
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
