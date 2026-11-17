-- Run after the M4 run migration in a disposable database. All fixtures roll back.
\set ON_ERROR_STOP on
begin;

create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end;
$$;

insert into auth.users(id) values
  ('a9000000-0000-4000-8000-000000000001'),
  ('a9000000-0000-4000-8000-000000000002');
update public.site_memberships set role = 'developer'
  where user_id = 'a9000000-0000-4000-8000-000000000002'
    and site_id = 'b1000000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a9000000-0000-4000-8000-000000000001', true);
do $$ begin
  begin
    insert into public.navigation_sessions(user_id, site_id, map_version_id,
      agent_type, device_id, mode, data_origin)
    values ('a9000000-0000-4000-8000-000000000001',
      'b1000000-0000-4000-8000-000000000001',
      'b2000000-0000-4000-8000-000000000001',
      'robot_proxy', 'm4-run-test-phone', 'live', 'live_sdk');
    raise exception 'visitor inserted a run';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', 'a9000000-0000-4000-8000-000000000002', true);
insert into public.navigation_sessions(user_id, site_id, map_version_id,
  agent_type, device_id, mode, data_origin)
values ('a9000000-0000-4000-8000-000000000002',
  'b1000000-0000-4000-8000-000000000001',
  'b2000000-0000-4000-8000-000000000001',
  'robot_proxy', 'm4-run-test-phone', 'live', 'live_sdk');
select pg_temp.assert_true((select count(*) = 1 from public.navigation_sessions
  where device_id = 'm4-run-test-phone' and device_model is null),
  'developer starts a run without inventing a device model');
select set_config('request.jwt.claim.sub', 'a9000000-0000-4000-8000-000000000001', true);
select pg_temp.assert_true((select count(*) = 0 from public.navigation_sessions
  where device_id = 'm4-run-test-phone'),
  'visitor cannot read an existing run');
select set_config('request.jwt.claim.sub', 'a9000000-0000-4000-8000-000000000002', true);
do $$ begin
  begin
    insert into public.navigation_sessions(user_id, site_id, map_version_id,
      agent_type, device_id, mode, data_origin)
    values ('a9000000-0000-4000-8000-000000000002',
      'b1000000-0000-4000-8000-000000000001',
      'b2000000-0000-4000-8000-000000000001',
      'robot_proxy', 'm4-run-test-phone', 'live', 'live_sdk');
    raise exception 'duplicate active run inserted';
  exception when unique_violation then null;
  end;
end $$;
update public.navigation_sessions set status = 'ended', ended_at = now()
  where device_id = 'm4-run-test-phone';
select pg_temp.assert_true((select count(*) = 1 from public.navigation_sessions
  where device_id = 'm4-run-test-phone' and status = 'ended' and ended_at is not null),
  'developer stops a run');

reset role;
-- A delayed upload carries capture time from before Stop Run.
insert into public.pose_samples(sample_id, map_version_id, device_id, provider_pose,
  world_position, tracking_status, data_origin, captured_at)
select 'a9000000-0000-4000-8000-000000000011', map_version_id, device_id,
  '{}', '{"x_m":1,"y_m":0,"z_m":1}', 'valid', 'real', started_at
from public.navigation_sessions where device_id = 'm4-run-test-phone';
select pg_temp.assert_true((select p.session_id = s.session_id
  from public.pose_samples p join public.navigation_sessions s
    on s.device_id = p.device_id
  where p.sample_id = 'a9000000-0000-4000-8000-000000000011'),
  'late pose attaches to ended run');

insert into public.test_points(test_point_id, map_version_id, label,
  reference_position, reference_method, reference_uncertainty_m,
  reference_is_verified)
values ('a9000000-0000-4000-8000-000000000021',
  'b2000000-0000-4000-8000-000000000001', 'Run fixture',
  '{"x_m":0,"y_m":0,"z_m":0}', 'local test reference', 0.1, true);
insert into public.localization_attempts(attempt_id, map_version_id, test_point_id,
  device_id, sdk_version, mode, data_origin, condition_label, camera_direction,
  started_at, ended_at, outcome, failure_reason)
select 'a9000000-0000-4000-8000-000000000031', s.map_version_id,
  'a9000000-0000-4000-8000-000000000021', s.device_id, 'NSDK 4.1.0',
  'live', 'live_sdk', 'Run fixture', 'yaw 120 deg', s.started_at,
  s.started_at + interval '1 second', 'tracking_loss', 'tracking lost'
from public.navigation_sessions s where s.device_id = 'm4-run-test-phone';
select pg_temp.assert_true((select a.session_id = s.session_id
  from public.localization_attempts a join public.navigation_sessions s
    on s.device_id = a.device_id
  where a.attempt_id = 'a9000000-0000-4000-8000-000000000031'),
  'late failure attempt attaches to ended run');

insert into public.pose_samples(sample_id, map_version_id, device_id, provider_pose,
  world_position, tracking_status, data_origin, captured_at)
select 'a9000000-0000-4000-8000-000000000012', map_version_id, device_id,
  '{}', '{"x_m":1,"y_m":0,"z_m":1}', 'valid', 'real', ended_at + interval '1 second'
from public.navigation_sessions where device_id = 'm4-run-test-phone';
select pg_temp.assert_true((select session_id is null from public.pose_samples
  where sample_id = 'a9000000-0000-4000-8000-000000000012'),
  'pose captured after Stop has no run');

rollback;
