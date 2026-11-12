-- Run after the M2 seed, HSS 349 seed, M3, and M4 attempt migration.
-- All test records are rolled back.
\set ON_ERROR_STOP on
begin;

insert into public.test_points (
  test_point_id, map_version_id, label, reference_position,
  reference_method, reference_uncertainty_m, reference_is_verified
) values (
  'b6000000-0000-4000-8000-000000000091',
  'b2000000-0000-4000-8000-000000000001', 'API verified fixture',
  '{"x_m":0,"y_m":0,"z_m":0}', 'local test reference', 0.1, true
), (
  'b6000000-0000-4000-8000-000000000092',
  'b2000000-0000-4000-8000-000000000001', 'API unverified fixture',
  '{"x_m":0,"y_m":0,"z_m":0}', null, null, false
);

insert into public.pose_samples (
  sample_id, map_version_id, device_id, provider_pose, world_position,
  tracking_status, data_origin, captured_at
) values (
  'b7000000-0000-4000-8000-000000000091',
  'b2000000-0000-4000-8000-000000000001', 'test-phone',
  '{}', '{"x_m":1,"y_m":0,"z_m":1}', 'valid', 'real',
  '2026-11-10T10:00:01Z'
), (
  'b7000000-0000-4000-8000-000000000092',
  'b2000000-0000-4000-8000-000000000001', 'test-phone',
  '{}', '{"x_m":3,"y_m":0,"z_m":4}', 'valid', 'real',
  '2026-11-10T10:00:02Z'
), (
  'b7000000-0000-4000-8000-000000000093',
  'b2000000-0000-4000-8000-000000000001', 'test-phone',
  '{}', '{"x_m":9,"y_m":0,"z_m":9}', 'valid', 'synthetic',
  '2026-11-10T10:00:00Z'
), (
  'b7000000-0000-4000-8000-000000000094',
  'b2000000-0000-4000-8000-000000000001', 'test-phone',
  '{}', '{"x_m":2,"y_m":0,"z_m":2}', 'valid', 'real',
  '2026-11-10T10:00:10Z'
);

set local role anon;
do $$
begin
  begin
    perform public.m4_record_live_attempt('{}'::jsonb);
    raise exception 'anonymous caller could execute attempt ingestion';
  exception when insufficient_privilege then null;
  end;
end;
$$;

set local role service_role;
do $$
declare
  request jsonb := jsonb_build_object(
    'attempt_id', 'b8000000-0000-4000-8000-000000000091',
    'map_version_id', 'b2000000-0000-4000-8000-000000000001',
    'test_point_id', 'b6000000-0000-4000-8000-000000000091',
    'device_id', 'test-phone', 'sdk_version', 'NSDK 4.1.0',
    'condition_label', 'run 1 try 1', 'camera_direction', 'yaw 120 deg',
    'started_at', '2026-11-10T10:00:00Z', 'ended_at', '2026-11-10T10:00:05Z',
    'outcome', 'success', 'failure_reason', null, 'latency_ms', 4000
  );
  result jsonb;
begin
  result := public.m4_record_live_attempt(request);
  if result->>'created' <> 'true' or result->>'error_is_valid' <> 'true'
    or abs((result->>'horizontal_error_m')::float8 - sqrt(2.0)) > 0.000001
    or result->>'valid_pose_sample_id' <> 'b7000000-0000-4000-8000-000000000091'
  then raise exception 'first real valid pose and horizontal error were not saved'; end if;
  result := public.m4_record_live_attempt(request);
  if result->>'created' <> 'false' then raise exception 'retry was not idempotent'; end if;
  if (select count(*) from public.localization_attempts
      where attempt_id = 'b8000000-0000-4000-8000-000000000091') <> 1
  then raise exception 'retry created a second attempt'; end if;
  begin
    perform public.m4_record_live_attempt(request || '{"device_id":"other-phone"}'::jsonb);
    raise exception 'reused attempt_id with changed data was accepted';
  exception when unique_violation then null;
  end;

  request := request || jsonb_build_object(
    'attempt_id', 'b8000000-0000-4000-8000-000000000092',
    'test_point_id', 'b6000000-0000-4000-8000-000000000092',
    'started_at', '2026-11-10T10:00:06Z', 'ended_at', '2026-11-10T10:00:07Z',
    'outcome', 'cancelled', 'failure_reason', 'user stopped', 'latency_ms', null
  );
  result := public.m4_record_live_attempt(request);
  if result->>'created' <> 'true' or result->>'error_is_valid' <> 'false'
    or result->>'horizontal_error_m' is not null
  then raise exception 'failed attempt was not stored correctly'; end if;

  request := request || jsonb_build_object(
    'attempt_id', 'b8000000-0000-4000-8000-000000000093',
    'started_at', '2026-11-10T10:00:09Z', 'ended_at', '2026-11-10T10:00:12Z',
    'outcome', 'success', 'failure_reason', null, 'latency_ms', 2000
  );
  result := public.m4_record_live_attempt(request);
  if result->>'valid_pose_sample_id' <> 'b7000000-0000-4000-8000-000000000094'
    or result->>'error_is_valid' <> 'false'
    or result->>'horizontal_error_m' is not null
  then raise exception 'unverified point incorrectly gained a measured error'; end if;
end;
$$;

rollback;
