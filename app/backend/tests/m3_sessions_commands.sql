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
   '20000000-0000-4000-8000-000000000001', 'robot_proxy', 'synthetic-robot',
   'synthetic', 'simulation', 'synthetic');

insert into public.simulated_agents (session_id, map_version_id, position, speed_mps)
values ('80000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001',
        '{"x_m":0,"y_m":0,"z_m":0}', 1);

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
        '80000000-0000-4000-8000-000000000001', 'synthetic-robot', null, null,
        'lost', 'synthetic', now());
select pg_temp.assert_true((select provider_pose is null and world_position is null
  from public.pose_samples limit 1), 'lost pose may omit coordinates');

update public.localization_attempts
set session_id = '80000000-0000-4000-8000-000000000001'
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
select pg_temp.expect_error($q$insert into public.navigation_sessions
  (site_id,map_version_id,agent_type,device_id,device_model,mode,data_origin) values
  ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
   'robot_proxy','bad-mode','synthetic','live','live_sdk')$q$,
  '23514', 'robot proxy requires simulation mode');
select pg_temp.expect_error($q$update public.navigation_sessions
  set agent_type = 'visitor'
  where session_id = '80000000-0000-4000-8000-000000000001'$q$,
  '23514', 'robot session identity cannot change');
select pg_temp.expect_error($q$update public.localization_attempts
  set session_id = '80000000-0000-4000-8000-000000000099'
  where attempt_id = '70000000-0000-4000-8000-000000000005'$q$,
  '23503', 'attempt rejects missing session');

set local role anon;
select pg_temp.assert_true(not has_table_privilege(current_user,
  'public.robot_commands', 'INSERT'), 'anonymous cannot issue robot commands');
reset role;
rollback;
