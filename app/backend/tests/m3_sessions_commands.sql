-- Run in a disposable database after M2, pose, M3 migrations, and M2 seed.sql.
\set ON_ERROR_STOP on
begin;

create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end;
$$;
create function pg_temp.expect_error(statement text, expected_state text, label text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then
    if sqlstate = expected_state then raise notice 'PASS: %', label; return; end if;
    raise;
  end;
  raise exception 'FAIL: % (expected SQLSTATE %)', label, expected_state;
end;
$$;

insert into public.navigation_sessions
  (session_id, site_id, map_version_id, agent_type, device_id, device_model, mode, data_origin)
values
  ('80000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000001', 'robot_proxy', 'test-phone',
   'test-phone', 'live', 'live_sdk');

insert into public.navigation_sessions
  (session_id, site_id, map_version_id, agent_type, device_id, device_model, mode, data_origin)
values
  ('80000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000001', 'visitor', 'synthetic-fixture',
   'synthetic', 'simulation', 'synthetic');

insert into public.simulated_agents (session_id, map_version_id, position, speed_mps)
values ('80000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001', null, 1);
select pg_temp.assert_true((select position is null from public.simulated_agents),
  'robot state can wait for first live pose');

insert into public.robot_commands (session_id, map_version_id, command, destination_id)
values ('80000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001',
        'set_destination', '50000000-0000-4000-8000-000000000001');
select pg_temp.assert_true((select count(*) = 1 from public.robot_commands),
  'robot command and destination link');
update public.robot_commands
set status = 'rejected', reason = 'Synthetic test rejection', updated_at = '2020-01-01'
where session_id = '80000000-0000-4000-8000-000000000001';
select pg_temp.assert_true((select status = 'rejected'
  and reason = 'Synthetic test rejection' and updated_at > '2020-01-01'
  from public.robot_commands limit 1), 'rejection reason and updated timestamp');

insert into public.pose_samples
  (map_version_id, session_id, device_id, provider_pose, world_position,
   tracking_status, data_origin, captured_at)
values ('20000000-0000-4000-8000-000000000001',
        '80000000-0000-4000-8000-000000000001', 'test-phone', null, null,
        'lost', 'real', now());
select pg_temp.assert_true((select provider_pose is null and world_position is null
  from public.pose_samples limit 1), 'lost pose may omit coordinates');

update public.localization_attempts
set session_id = '80000000-0000-4000-8000-000000000002'
where attempt_id = '70000000-0000-4000-8000-000000000005';
select pg_temp.assert_true((select session_id is not null from public.localization_attempts
  where attempt_id = '70000000-0000-4000-8000-000000000005'),
  'existing failure links to same-map session');

select pg_temp.expect_error($q$insert into public.robot_commands
  (session_id,map_version_id,command) values
  ('80000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','set_destination')$q$,
  '23514', 'destination command requires destination');
select pg_temp.expect_error($q$insert into public.robot_commands
  (session_id,map_version_id,command,destination_id) values
  ('80000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','pause','50000000-0000-4000-8000-000000000001')$q$,
  '23514', 'other commands do not accept destination');
select pg_temp.expect_error($q$update public.robot_commands
  set status = 'applied' where session_id = '80000000-0000-4000-8000-000000000001'$q$,
  '23514', 'non-rejected command cannot retain a reason');
select pg_temp.expect_error($q$insert into public.pose_samples
  (map_version_id,device_id,tracking_status,data_origin,captured_at)
  values ('20000000-0000-4000-8000-000000000001','test-phone','valid','real',now())$q$,
  '23514', 'valid pose requires provider and world positions');
select pg_temp.expect_error($q$insert into public.pose_samples
  (map_version_id,device_id,provider_pose,world_position,tracking_status,data_origin,captured_at)
  values ('20000000-0000-4000-8000-000000000001','test-phone','{}','{}','valid','real',now())$q$,
  '23514', 'valid pose requires usable world coordinates');
select pg_temp.expect_error($q$update public.navigation_sessions
  set agent_type = 'visitor'
  where session_id = '80000000-0000-4000-8000-000000000001'$q$,
  '23514', 'robot session identity cannot change');
select pg_temp.expect_error($q$update public.localization_attempts
  set session_id = '80000000-0000-4000-8000-000000000099'
  where attempt_id = '70000000-0000-4000-8000-000000000005'$q$,
  '23503', 'attempt rejects missing session');
select pg_temp.expect_error($q$update public.localization_attempts
  set horizontal_error_m = -1 where attempt_id = '70000000-0000-4000-8000-000000000001'$q$,
  '23514', 'negative horizontal error rejected');

insert into public.test_points
  (test_point_id,map_version_id,label,reference_position,reference_method,
   reference_uncertainty_m,reference_is_verified)
values ('60000000-0000-4000-8000-000000000007',
  '20000000-0000-4000-8000-000000000001', 'Local verified fixture',
  '{"x_m":0,"y_m":0,"z_m":0}', 'Local SQL fixture', 0.1, true);
insert into public.localization_attempts
  (attempt_id,session_id,map_version_id,test_point_id,device_id,sdk_version,
   mode,data_origin,condition_label,camera_direction,started_at,ended_at,
   outcome,latency_ms)
values ('70000000-0000-4000-8000-000000000012',
  '80000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000007',
  'test-phone','local-test-sdk','live','live_sdk','local fixture','+Z',
  now() - interval '3 seconds',now(),'success',1000);
insert into public.pose_samples
  (sample_id,map_version_id,session_id,attempt_id,device_id,provider_pose,
   world_position,tracking_status,data_origin,captured_at)
values ('90000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '80000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000012','test-phone',
  '{"position":{"x":1,"y":0,"z":0}}',
  '{"x_m":1,"y_m":0,"z_m":0}', 'valid','real',now());
update public.localization_attempts
set valid_pose_sample_id = '90000000-0000-4000-8000-000000000001',
    horizontal_error_m = 1, error_is_valid = true
where attempt_id = '70000000-0000-4000-8000-000000000012';
select pg_temp.assert_true((select horizontal_error_m = 1 and error_is_valid
  from public.localization_attempts
  where attempt_id = '70000000-0000-4000-8000-000000000012'),
  'verified live accuracy can be stored');

insert into public.sites (site_id,name)
values ('10000000-0000-4000-8000-000000000002','Private local fixture');
insert into public.map_versions
  (map_version_id,site_id,version_label,publication_state,world_frame,published_at)
select '20000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000002','Private local fixture',
  'published',world_frame,now()
from public.map_versions
where map_version_id = '20000000-0000-4000-8000-000000000001';
insert into public.test_points (test_point_id,map_version_id,label)
values ('60000000-0000-4000-8000-000000000008',
  '20000000-0000-4000-8000-000000000002','Private local fixture');
insert into public.localization_attempts
  (attempt_id,map_version_id,test_point_id,device_id,sdk_version,mode,data_origin,
   condition_label,camera_direction,started_at,outcome)
values ('70000000-0000-4000-8000-000000000013',
  '20000000-0000-4000-8000-000000000002',
  '60000000-0000-4000-8000-000000000008','test-phone','local-test-sdk',
  'live','live_sdk','local fixture','+Z',now(),'in_progress');

set local role anon;
select pg_temp.assert_true((select count(*) = 1 from public.localization_attempts
  where attempt_id = '70000000-0000-4000-8000-000000000012'),
  'anonymous health read sees live attempt on public demo map');
select pg_temp.assert_true((select count(*) = 0 from public.localization_attempts
  where attempt_id = '70000000-0000-4000-8000-000000000013'),
  'anonymous health read hides private-site live attempt');
select pg_temp.assert_true(not has_table_privilege(current_user,
  'public.robot_commands', 'INSERT'), 'anonymous cannot issue robot commands');
reset role;
rollback;
