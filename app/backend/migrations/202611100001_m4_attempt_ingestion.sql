-- Save a phone attempt and its first valid pose in one transaction.
-- Apply after the M3 sessions migration. The server calls this with its
-- service-role key only after checking x-device-token and validating input.
begin;

-- pose_samples.sql predates the service-role grants used by the later APIs.
grant select, insert, update(attempt_id) on public.pose_samples to service_role;

create function public.m4_record_live_attempt(p_attempt jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_id uuid := (p_attempt->>'attempt_id')::uuid;
  v_map_id uuid := (p_attempt->>'map_version_id')::uuid;
  v_point_id uuid := (p_attempt->>'test_point_id')::uuid;
  v_existing public.localization_attempts%rowtype;
  v_point public.test_points%rowtype;
  v_pose public.pose_samples%rowtype;
  v_created boolean := false;
  v_error double precision;
begin
  select * into v_existing from public.localization_attempts a where a.attempt_id = v_id;
  -- A retry remains valid if the map is retired after the original insert.
  if not found and not exists (
    select 1 from public.map_versions m
    where m.map_version_id = v_map_id and m.publication_state = 'published'
  ) then
    raise exception 'unknown or unpublished map_version_id' using errcode = '22023';
  end if;
  select * into v_point from public.test_points t
  where t.map_version_id = v_map_id and t.test_point_id = v_point_id
    and not t.is_synthetic;
  if not found then
    raise exception 'unknown or synthetic test_point_id for map' using errcode = '22023';
  end if;

  insert into public.localization_attempts (
    attempt_id, map_version_id, test_point_id, device_id, sdk_version,
    mode, data_origin, condition_label, camera_direction, started_at,
    ended_at, outcome, failure_reason, latency_ms
  ) values (
    v_id, v_map_id, v_point_id, p_attempt->>'device_id', p_attempt->>'sdk_version',
    'live', 'live_sdk', p_attempt->>'condition_label', p_attempt->>'camera_direction',
    (p_attempt->>'started_at')::timestamptz, (p_attempt->>'ended_at')::timestamptz,
    p_attempt->>'outcome', p_attempt->>'failure_reason',
    (p_attempt->>'latency_ms')::double precision
  ) on conflict (attempt_id) do nothing;
  v_created := found;

  select * into v_existing from public.localization_attempts a where a.attempt_id = v_id;
  if not found or (
    v_existing.map_version_id, v_existing.test_point_id, v_existing.device_id,
    v_existing.sdk_version, v_existing.mode, v_existing.data_origin,
    v_existing.condition_label, v_existing.camera_direction, v_existing.started_at,
    v_existing.ended_at, v_existing.outcome, v_existing.failure_reason,
    v_existing.latency_ms
  ) is distinct from (
    v_map_id, v_point_id, p_attempt->>'device_id', p_attempt->>'sdk_version',
    'live', 'live_sdk', p_attempt->>'condition_label', p_attempt->>'camera_direction',
    (p_attempt->>'started_at')::timestamptz, (p_attempt->>'ended_at')::timestamptz,
    p_attempt->>'outcome', p_attempt->>'failure_reason',
    (p_attempt->>'latency_ms')::double precision
  ) then
    raise exception 'attempt_id already belongs to different data' using errcode = '23505';
  end if;

  -- The phone sends the attempt after the try, so poses can be stored first
  -- with no attempt_id. Never use a fake pose or one from another map/device.
  if v_existing.outcome = 'success' and v_existing.valid_pose_sample_id is null then
    select * into v_pose from public.pose_samples p
    where p.map_version_id = v_map_id and p.device_id = v_existing.device_id
      and p.captured_at between v_existing.started_at and v_existing.ended_at
      and p.tracking_status = 'valid' and p.data_origin = 'real'
      and p.world_position is not null
      and (p.attempt_id is null or p.attempt_id = v_id)
    order by p.captured_at, p.sample_id limit 1 for update;
    if found then
      update public.pose_samples set attempt_id = v_id
      where sample_id = v_pose.sample_id and attempt_id is null;
      if v_point.reference_is_verified then
        v_error := sqrt(
          power((v_pose.world_position->>'x_m')::double precision
              - (v_point.reference_position->>'x_m')::double precision, 2)
          + power((v_pose.world_position->>'z_m')::double precision
              - (v_point.reference_position->>'z_m')::double precision, 2)
        );
      end if;
      update public.localization_attempts set
        valid_pose_sample_id = v_pose.sample_id,
        horizontal_error_m = v_error,
        error_is_valid = (v_error is not null)
      where attempt_id = v_id;
    end if;
  end if;

  select * into v_existing from public.localization_attempts a where a.attempt_id = v_id;
  return jsonb_build_object(
    'attempt_id', v_id, 'created', v_created,
    'valid_pose_sample_id', v_existing.valid_pose_sample_id,
    'horizontal_error_m', v_existing.horizontal_error_m,
    'error_is_valid', v_existing.error_is_valid
  );
end;
$$;

revoke all on function public.m4_record_live_attempt(jsonb) from public, anon, authenticated;
grant execute on function public.m4_record_live_attempt(jsonb) to service_role;

commit;
