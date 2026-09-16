-- CSC 648 Team 02 database schema
-- Supabase (PostgreSQL 17)
-- Run in Supabase SQL Editor to recreate tables.

create table public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text,
  created_at timestamptz default now()
);

create table public.team_members (
  id serial primary key,
  name text not null,
  role text not null,
  github_url text,
  image_url text,
  bio text
);

alter table public.users enable row level security;
alter table public.team_members enable row level security;

create policy "public read team members"
  on public.team_members for select using (true);
  