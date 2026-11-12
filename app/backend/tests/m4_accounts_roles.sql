-- Run after the M4 account migration and M2 seed in a disposable database.
\set ON_ERROR_STOP on
begin;

create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end;
$$;
create function pg_temp.expect_denied(statement text, label text) returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when insufficient_privilege then
    raise notice 'PASS: %', label;
    return;
  end;
  raise exception 'FAIL: %', label;
end;
$$;

insert into auth.users(id) values
  ('a0000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000002'),
  ('a0000000-0000-4000-8000-000000000003');
select pg_temp.assert_true((select count(*) = 3 from public.user_profiles
  where user_id::text like 'a0000000-%'), 'Auth users get profiles');
select pg_temp.assert_true((select count(*) = 3 from public.site_memberships
  where user_id::text like 'a0000000-%'
    and site_id = 'b1000000-0000-4000-8000-000000000001'
    and role = 'visitor' and is_active), 'new Auth users get HSS 349 visitor access');

insert into public.site_memberships(user_id, site_id, role) values
  ('a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'visitor'),
  ('a0000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'operator'),
  ('a0000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'administrator');
insert into public.sites(site_id, name) values
  ('10000000-0000-4000-8000-000000000099', 'Other site fixture');
insert into public.map_versions(map_version_id, site_id, version_label, world_frame)
select '20000000-0000-4000-8000-000000000099',
       '10000000-0000-4000-8000-000000000099', 'Other site fixture', world_frame
from public.map_versions where map_version_id = '20000000-0000-4000-8000-000000000001';

set local role anon;
select pg_temp.expect_denied($q$update public.path_segments
  set availability = 'closed' where segment_id = '40000000-0000-4000-8000-000000000001'$q$,
  'anonymous users cannot update segments');
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000001', true);
select pg_temp.assert_true((select count(*) = 2 from public.site_memberships
  where user_id = 'a0000000-0000-4000-8000-000000000001'),
  'visitor sees own memberships for both sites, not other users');
select pg_temp.assert_true((select count(*) = 0 from public.path_segments
  where segment_id = '40000000-0000-4000-8000-000000000001'
    and private.can_change_segments(map_version_id)), 'visitor lacks segment role');
with attempted as (
  update public.site_memberships set role = 'administrator'
  where user_id = 'a0000000-0000-4000-8000-000000000001'
  returning membership_id
)
select pg_temp.assert_true((select count(*) = 0 from attempted),
  'visitor cannot promote own membership');
with attempted as (
  update public.path_segments set availability = 'closed'
  where segment_id = '40000000-0000-4000-8000-000000000001'
  returning segment_id
)
select pg_temp.assert_true((select count(*) = 0 from attempted),
  'RLS rejects visitor segment update');
select pg_temp.expect_denied($q$update public.path_segments
  set geometry = '[]' where segment_id = '40000000-0000-4000-8000-000000000001'$q$,
  'browser cannot edit segment geometry');

select set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000002', true);
select pg_temp.assert_true((select private.can_change_segments(
  '20000000-0000-4000-8000-000000000001')), 'operator can manage own site');
select pg_temp.assert_true((select not private.can_change_segments(
  '20000000-0000-4000-8000-000000000099')), 'operator cannot manage another site');
update public.path_segments set availability = 'closed'
where segment_id = '40000000-0000-4000-8000-000000000001';
select pg_temp.assert_true((select current_path_state_revision = 2 from public.map_versions
  where map_version_id = '20000000-0000-4000-8000-000000000001'),
  'segment and map revisions update atomically');
select pg_temp.assert_true((select last_state_revision = 2 and availability = 'closed'
  from public.path_segments where segment_id = '40000000-0000-4000-8000-000000000001'),
  'segment stores the new revision');
update public.path_segments set availability = 'closed'
where segment_id = '40000000-0000-4000-8000-000000000001';
select pg_temp.assert_true((select current_path_state_revision = 2 from public.map_versions
  where map_version_id = '20000000-0000-4000-8000-000000000001'),
  'no-op update does not bump revision');

select set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000003', true);
update public.site_memberships set role = 'developer'
where user_id = 'a0000000-0000-4000-8000-000000000001';
select pg_temp.assert_true((select role = 'developer' from public.site_memberships
  where user_id = 'a0000000-0000-4000-8000-000000000001'),
  'administrator can change a site role');
update public.path_segments set robot_access = 'restricted'
where segment_id = '40000000-0000-4000-8000-000000000001';
select pg_temp.assert_true((select availability = 'closed' and robot_access = 'restricted'
  and last_state_revision = 3 from public.path_segments
  where segment_id = '40000000-0000-4000-8000-000000000001'),
  'robot restriction survives a closed segment');

rollback;
