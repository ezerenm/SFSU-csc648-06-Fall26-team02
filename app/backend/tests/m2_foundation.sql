-- Run only in a disposable local database after the migration and seed.sql.
-- All fixtures and changes below roll back. ON_ERROR_STOP makes failures visible.
\set ON_ERROR_STOP on
begin;
set constraints all immediate;

create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end;
$$;
create function pg_temp.expect_error(statement text, expected_state text, label text) returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate = expected_state then raise notice 'PASS: %', label; return; end if;
    raise;
  end;
  raise exception 'FAIL: % (expected SQLSTATE %)', label, expected_state;
end;
$$;

select pg_temp.assert_true((select count(*) = 8 from public.graph_nodes), 'eight sample nodes');
select pg_temp.assert_true((select count(*) = 10 from public.path_segments), 'ten sample segments');
select pg_temp.assert_true((select count(*) = 3 from public.destinations), 'three sample destinations');
select pg_temp.assert_true((select count(*) = 5 from public.test_points), 'five sample test points');
select pg_temp.assert_true((select count(*) = 10 from public.localization_attempts), 'ten sample attempts');
select pg_temp.assert_true((select count(*) = 4 from public.localization_attempts where outcome = 'success'), 'four synthetic successes');
select pg_temp.assert_true((select count(*) = 1 from public.localization_attempts where test_point_id = '60000000-0000-4000-8000-000000000002' and outcome = 'timeout'), 'combined point/outcome filter');
select pg_temp.assert_true((select count(*) = 0 from public.localization_attempts where outcome = 'in_progress'), 'valid empty search');
select pg_temp.assert_true((select sum(distance_m) = 8 from public.path_segments where label in ('S1 N1 to N2','S2 N2 to N3')), 'human expected path distance 8m');
select pg_temp.assert_true((select sum(distance_m) = 16 from public.path_segments where label in ('S1 N1 to N2','S3 N2 to N4','S4 N4 to N5','S5 N5 to N3')), 'robot expected path distance 16m');

insert into public.sites (site_id,name) values ('10000000-0000-4000-8000-000000000002','Private test site');
insert into public.map_versions (map_version_id,site_id,version_label,world_frame,publication_state,published_at)
select '20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','Private',world_frame,'published',now() from public.map_versions limit 1;
insert into public.map_versions (map_version_id,site_id,version_label,world_frame)
select '20000000-0000-4000-8000-000000000003',site_id,'Draft',world_frame from public.map_versions where map_version_id = '20000000-0000-4000-8000-000000000001';
insert into public.graph_nodes (node_id,map_version_id,label,position)
values ('30000000-0000-4000-8000-000000000009','20000000-0000-4000-8000-000000000002','Private node','{"x_m":0,"y_m":0,"z_m":0}');
insert into public.graph_nodes (node_id,map_version_id,graph_revision,label,position)
values ('30000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000001',2,'Future revision','{"x_m":0,"y_m":0,"z_m":0}');
insert into public.test_points (test_point_id,map_version_id,label)
values ('60000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000001','Private real point');
insert into public.localization_attempts (attempt_id,map_version_id,test_point_id,device_id,sdk_version,mode,data_origin,condition_label,camera_direction,started_at,ended_at,outcome,failure_reason)
values ('70000000-0000-4000-8000-000000000011','20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000006','test-only-device','test-only-sdk','live','live_sdk','Test only','+Z',now()-interval '30 seconds',now(),'timeout','Local test fixture, not a field trial');

select pg_temp.expect_error($q$update public.sites set active_map_version_id = '20000000-0000-4000-8000-000000000002' where site_id = '10000000-0000-4000-8000-000000000001'$q$, '23503', 'active map cannot belong to another site');
select pg_temp.expect_error($q$update public.sites set active_map_version_id = '20000000-0000-4000-8000-000000000003' where site_id = '10000000-0000-4000-8000-000000000001'$q$, '23514', 'active map cannot be a draft');
select pg_temp.expect_error($q$update public.map_versions set publication_state = 'retired' where map_version_id = '20000000-0000-4000-8000-000000000001'$q$, '23514', 'retiring an active map requires clearing or replacing it');
select pg_temp.expect_error($q$update public.path_segments set end_node_id = '30000000-0000-4000-8000-000000000009' where segment_id = '40000000-0000-4000-8000-000000000001'$q$, '23503', 'edge rejects endpoint from another map');
select pg_temp.expect_error($q$update public.path_segments set end_node_id = '30000000-0000-4000-8000-000000000010' where segment_id = '40000000-0000-4000-8000-000000000001'$q$, '23503', 'edge rejects endpoint from another revision');
select pg_temp.expect_error($q$update public.path_segments set end_node_id = start_node_id$q$, '23514', 'self edges rejected');
select pg_temp.expect_error($q$update public.destinations set node_id = '30000000-0000-4000-8000-000000000009'$q$, '23503', 'destination rejects wrong-map node');
select pg_temp.expect_error($q$update public.destinations set node_id = '30000000-0000-4000-8000-000000000010'$q$, '23503', 'destination rejects wrong-revision node');
select pg_temp.expect_error($q$update public.destinations set site_id = '10000000-0000-4000-8000-000000000002'$q$, '23503', 'destination rejects wrong site');
select pg_temp.expect_error($q$update public.localization_attempts set map_version_id = '20000000-0000-4000-8000-000000000002'$q$, '23503', 'attempt rejects wrong-map test point');
select pg_temp.expect_error($q$update public.path_segments set distance_m = 0$q$, '23514', 'zero distance rejected');
select pg_temp.expect_error($q$update public.path_segments set distance_m = 'NaN'$q$, '23514', 'NaN distance rejected');
select pg_temp.expect_error($q$update public.path_segments set distance_m = 'Infinity'$q$, '23514', 'infinite distance rejected');
select pg_temp.expect_error($q$update public.path_segments set distance_m = 99$q$, '23514', 'distance must match geometry');
select pg_temp.expect_error($q$update public.path_segments set direction = 'reverse'$q$, '23514', 'unknown direction rejected');
select pg_temp.expect_error($q$update public.path_segments set geometry = '[]'$q$, '23514', 'empty geometry rejected');
select pg_temp.expect_error($q$update public.path_segments set geometry = '[{"x_m":1,"y_m":0,"z_m":0},{"x_m":1,"y_m":0,"z_m":1}]'$q$, '23514', 'geometry endpoints must match nodes');
select pg_temp.expect_error($q$update public.graph_nodes set position = '{"x_m":null,"y_m":0,"z_m":0}'$q$, '23514', 'null position component rejected');
select pg_temp.expect_error($q$update public.graph_nodes set position = '{"x_m":1,"y_m":0,"z_m":0}' where node_id = '30000000-0000-4000-8000-000000000001'$q$, '23514', 'moving a node cannot leave stale edge geometry');
select pg_temp.expect_error($q$update public.map_versions set world_frame = '{"handedness":"left"}'$q$, '23514', 'incomplete or incompatible world frame rejected');
select pg_temp.expect_error($q$update public.test_points set reference_is_verified = true where is_synthetic$q$, '23514', 'synthetic reference cannot be verified');
select pg_temp.expect_error($q$update public.localization_attempts set outcome = 'unknown'$q$, '23514', 'unknown outcome rejected');
select pg_temp.expect_error($q$update public.localization_attempts set failure_reason = null where outcome = 'timeout'$q$, '23514', 'failure reason required');
select pg_temp.expect_error($q$update public.localization_attempts set latency_ms = 31000 where outcome = 'success'$q$, '23514', 'success must fit 30-second limit');
select pg_temp.expect_error($q$update public.localization_attempts set ended_at = started_at + interval '1 second' where outcome = 'timeout'$q$, '23514', 'timeout cannot finish before 30 seconds');
select pg_temp.expect_error($q$update public.localization_attempts set error_is_valid = true where data_origin = 'synthetic'$q$, '23514', 'synthetic rows cannot claim valid measured error');
select pg_temp.expect_error($q$update public.localization_attempts set mode = 'live' where data_origin = 'synthetic'$q$, '23514', 'synthetic rows cannot claim live mode');
select pg_temp.expect_error($q$update public.localization_attempts set valid_pose_sample_id = gen_random_uuid()$q$, '23514', 'deferred pose references stay null');
select pg_temp.expect_error($q$delete from public.graph_nodes where node_id = '30000000-0000-4000-8000-000000000001'$q$, '23503', 'referenced nodes cannot be deleted');

update public.path_segments set availability = 'closed' where segment_id = '40000000-0000-4000-8000-000000000002';
update public.path_segments set availability = 'open' where segment_id = '40000000-0000-4000-8000-000000000002';
select pg_temp.assert_true((select robot_access = 'restricted' from public.path_segments where segment_id = '40000000-0000-4000-8000-000000000002'), 'reopening preserves robot restriction');

set local role anon;
select pg_temp.assert_true((select bool_and(not has_table_privilege(current_user, 'public.' || t, 'INSERT,UPDATE,DELETE,TRUNCATE'))
  from unnest(array['sites','map_versions','graph_nodes','path_segments','destinations','test_points','localization_attempts']) t),
  'all seven tables deny anonymous write privileges');
select pg_temp.assert_true((select count(*) = 1 from public.sites), 'anonymous sees only public demo sites');
select pg_temp.assert_true((select count(*) = 1 from public.map_versions), 'anonymous sees only published demo maps');
select pg_temp.assert_true((select count(*) = 8 from public.graph_nodes), 'private and future-revision nodes hidden');
select pg_temp.assert_true((select count(*) = 5 from public.test_points), 'real test points hidden');
select pg_temp.assert_true((select count(*) = 10 from public.localization_attempts), 'live attempts hidden');
select pg_temp.assert_true(jsonb_array_length(public.m2_get_graph('20000000-0000-4000-8000-000000000001')->'nodes') = 8, 'graph RPC returns current nodes under RLS');
select pg_temp.assert_true(jsonb_array_length(public.m2_get_graph('20000000-0000-4000-8000-000000000001')->'segments') = 10, 'graph RPC returns segments under RLS');
select pg_temp.assert_true(public.m2_get_graph('20000000-0000-4000-8000-000000000002') is null, 'graph RPC hides private map');
select pg_temp.assert_true(public.m2_get_graph('20000000-0000-4000-8000-000000000003') is null, 'graph RPC hides draft map');
select pg_temp.assert_true(public.m2_get_graph('20000000-0000-4000-8000-000000000099') is null, 'graph RPC handles missing map');
select pg_temp.expect_error($q$insert into public.sites(name) values ('Unauthorized')$q$, '42501', 'anonymous insert denied');
select pg_temp.expect_error($q$update public.path_segments set availability = 'closed'$q$, '42501', 'anonymous update denied');
select pg_temp.expect_error($q$delete from public.localization_attempts$q$, '42501', 'anonymous delete denied');

set local role authenticated;
select pg_temp.assert_true((select bool_and(not has_table_privilege(current_user, 'public.' || t, 'INSERT,UPDATE,DELETE,TRUNCATE'))
  from unnest(array['sites','map_versions','graph_nodes','path_segments','destinations','test_points','localization_attempts']) t),
  'all seven tables deny authenticated write privileges');
select pg_temp.assert_true((select count(*) = 10 from public.localization_attempts), 'login alone does not expose live records');
select pg_temp.expect_error($q$update public.path_segments set availability = 'closed'$q$, '42501', 'login alone does not grant writes');
reset role;
rollback;
