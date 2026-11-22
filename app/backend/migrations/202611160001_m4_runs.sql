-- Collection runs for the real robot phone. Apply after the M4 accounts and
-- attempt-ingestion migrations. The phone may upload records after a run ends.
begin;

alter table public.navigation_sessions alter column device_model drop not null;
alter table public.navigation_sessions drop constraint navigation_sessions_device_model_check;
alter table public.navigation_sessions add constraint navigation_sessions_device_model_check
  check (device_model is null or length(btrim(device_model)) between 1 and 120);

create unique index navigation_sessions_one_active_device_idx
  on public.navigation_sessions(map_version_id, device_id)
  where status = 'active' and agent_type = 'robot_proxy' and mode = 'live';
create index navigation_sessions_device_window_idx
  on public.navigation_sessions(map_version_id, device_id, started_at desc)
  where agent_type = 'robot_proxy' and mode = 'live';

-- Authenticated team members can start and stop collection for their site.
-- The service role remains available for trusted ingestion and robot APIs.
grant select, insert, update(status, ended_at) on public.navigation_sessions to authenticated;
create policy m4_runs_team_read on public.navigation_sessions for select to authenticated
  using (private.has_site_role(site_id, array['developer', 'operator', 'administrator']));
create policy m4_runs_team_insert on public.navigation_sessions for insert to authenticated
  with check (
    user_id = (select auth.uid()) and status = 'active' and ended_at is null
    and agent_type = 'robot_proxy' and mode = 'live' and data_origin = 'live_sdk'
    and private.has_site_role(site_id, array['developer', 'operator', 'administrator'])
  );
create policy m4_runs_team_stop on public.navigation_sessions for update to authenticated
  using (status = 'active' and private.has_site_role(site_id, array['developer', 'operator', 'administrator']))
  with check (status = 'ended' and ended_at is not null
    and private.has_site_role(site_id, array['developer', 'operator', 'administrator']));

-- Associate an upload by when it was captured, not when a retry reached the
-- server. A stopped run still owns its earlier poses and attempts.
create function private.m4_run_for_capture(
  requested_map_version_id uuid, requested_device_id text, captured_time timestamptz
) returns uuid language sql stable security definer set search_path = '' as $$
  select s.session_id from public.navigation_sessions s
  where s.map_version_id = requested_map_version_id
    and s.device_id = requested_device_id
    and s.agent_type = 'robot_proxy' and s.mode = 'live'
    and s.started_at <= captured_time
    and (s.ended_at is null or captured_time <= s.ended_at)
  order by s.started_at desc, s.session_id limit 1;
$$;
revoke all on function private.m4_run_for_capture(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function private.m4_run_for_capture(uuid, text, timestamptz) to service_role;

create function private.m4_attach_pose_run() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.session_id is null and new.data_origin = 'real' then
    new.session_id := private.m4_run_for_capture(new.map_version_id, new.device_id, new.captured_at);
  end if;
  return new;
end;
$$;
create trigger m4_pose_run before insert on public.pose_samples
  for each row execute function private.m4_attach_pose_run();

create function private.m4_attach_attempt_run() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.session_id is null and new.data_origin = 'live_sdk' then
    new.session_id := private.m4_run_for_capture(new.map_version_id, new.device_id, new.started_at);
  end if;
  return new;
end;
$$;
create trigger m4_attempt_run before insert on public.localization_attempts
  for each row execute function private.m4_attach_attempt_run();

commit;
