-- M4 accounts and per-site authorization. Apply after the M3 migration.
-- Supabase Auth owns credentials; these tables contain only application identity and roles.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or length(btrim(display_name)) between 1 and 120),
  created_at timestamptz not null default now()
);

create table public.site_memberships (
  membership_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(user_id) on delete cascade,
  site_id uuid not null references public.sites(site_id) on delete cascade,
  role text not null check (role in ('visitor', 'developer', 'operator', 'administrator')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, site_id)
);
create index site_memberships_site_role_idx
  on public.site_memberships(site_id, role) where is_active;

-- Existing Auth users also need profiles; new users get one automatically.
insert into public.user_profiles(user_id)
select id from auth.users on conflict (user_id) do nothing;

create function private.create_user_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.user_profiles(user_id) values (new.id)
  on conflict (user_id) do nothing;
  -- HSS 349 is the public demo site. A signup starts as a visitor; only a
  -- site administrator may promote that membership to an operator role.
  insert into public.site_memberships(user_id, site_id, role)
  select new.id, site.site_id, 'visitor'
    from public.sites site
   where site.site_id = 'b1000000-0000-4000-8000-000000000001'
  on conflict (user_id, site_id) do nothing;
  return new;
end;
$$;
create trigger auth_user_profile
  after insert on auth.users for each row
  execute function private.create_user_profile();

-- This helper is outside Supabase's exposed public schema. It checks the
-- current Auth user against stored memberships, never a client-supplied role.
create function private.has_site_role(requested_site_id uuid, allowed_roles text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.site_memberships membership
    where membership.user_id = (select auth.uid())
      and membership.site_id = requested_site_id
      and membership.is_active
      and membership.role = any(allowed_roles)
  );
$$;
revoke all on function private.has_site_role(uuid, text[]) from public;
grant execute on function private.has_site_role(uuid, text[]) to authenticated;

create function private.can_change_segments(requested_map_version_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.map_versions map
    where map.map_version_id = requested_map_version_id
      and private.has_site_role(map.site_id, array['operator', 'administrator'])
  );
$$;
revoke all on function private.can_change_segments(uuid) from public;
grant execute on function private.can_change_segments(uuid) to authenticated;

alter table public.user_profiles enable row level security;
alter table public.site_memberships enable row level security;
revoke all on public.user_profiles, public.site_memberships from public, anon, authenticated;
grant select, update(display_name) on public.user_profiles to authenticated;
grant select, insert, update(role, is_active) on public.site_memberships to authenticated;
grant all on public.user_profiles, public.site_memberships to service_role;

create policy m4_profile_self_read on public.user_profiles for select to authenticated
  using (user_id = (select auth.uid()));
create policy m4_profile_self_update on public.user_profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy m4_membership_read on public.site_memberships for select to authenticated
  using (user_id = (select auth.uid())
    or private.has_site_role(site_id, array['administrator']));
create policy m4_membership_admin_insert on public.site_memberships for insert to authenticated
  with check (private.has_site_role(site_id, array['administrator']));
create policy m4_membership_admin_update on public.site_memberships for update to authenticated
  using (private.has_site_role(site_id, array['administrator']))
  with check (private.has_site_role(site_id, array['administrator']));

-- The existing SELECT policy keeps published demo segments visible.
-- UPDATE is allowed only for a site operator or administrator, and only on
-- availability and robot_access. No browser can edit geometry or map identity.
grant update(availability, robot_access) on public.path_segments to authenticated;
create policy m4_operator_segments on public.path_segments for update to authenticated
  using (private.can_change_segments(map_version_id))
  with check (private.can_change_segments(map_version_id));

-- A single segment UPDATE changes both its state and the map revision in one
-- database transaction. This replaces the former two-request server update.
create function private.bump_segment_state_revision() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (new.availability, new.robot_access) is distinct from
     (old.availability, old.robot_access) then
    update public.map_versions
       set current_path_state_revision = current_path_state_revision + 1
     where map_version_id = new.map_version_id
     returning current_path_state_revision into new.last_state_revision;
  end if;
  return new;
end;
$$;
create trigger segment_state_revision
  before update of availability, robot_access on public.path_segments
  for each row execute function private.bump_segment_state_revision();

commit;
