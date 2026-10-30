-- M3 shared session, robot-command, and localization logging foundation.
-- Apply after pose_samples.sql and 202610190002_pose_samples_data_origin.sql.
-- This migration is additive and does not modify existing rows.
begin;

create table public.navigation_sessions (
  session_id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  site_id uuid not null,
  map_version_id uuid not null,
  agent_type text not null check (agent_type in ('visitor', 'robot_proxy')),
  device_id text not null check (length(btrim(device_id)) between 1 and 120),
  device_model text not null check (length(btrim(device_model)) between 1 and 120),
  sdk_version text check (length(btrim(sdk_version)) between 1 and 120),
  mode text not null check (mode in ('live', 'simulation', 'replay')),
  data_origin text not null check (data_origin in ('live_sdk', 'synthetic', 'recorded')),
  status text not null default 'active' check (status in ('active', 'ended', 'failed')),
  started_at timestamptz not null default now() check (isfinite(started_at)),
  ended_at timestamptz check (isfinite(ended_at)),
  unique (map_version_id, session_id),
  foreign key (site_id, map_version_id) references public.map_versions(site_id, map_version_id),
  check ((mode = 'live' and data_origin = 'live_sdk')
      or (mode = 'simulation' and data_origin = 'synthetic')
      or (mode = 'replay' and data_origin = 'recorded')),
  check (agent_type <> 'robot_proxy' or mode = 'simulation'),
  check ((status = 'active' and ended_at is null)
      or (status <> 'active' and ended_at is not null and ended_at >= started_at))
);

create index navigation_sessions_site_time_idx
  on public.navigation_sessions(site_id, started_at desc);
create index navigation_sessions_user_idx
  on public.navigation_sessions(user_id, started_at desc);

-- A session's identity and map cannot change after records attach to it.
create function public.m3_session_identity_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.site_id, new.map_version_id, new.agent_type, new.mode, new.data_origin)
     is distinct from
     (old.site_id, old.map_version_id, old.agent_type, old.mode, old.data_origin) then
    raise exception 'Session site, map, agent type, mode, and origin are immutable'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger navigation_session_identity_immutable
  before update of site_id, map_version_id, agent_type, mode, data_origin
  on public.navigation_sessions
  for each row execute function public.m3_session_identity_immutable();

-- M2 reserved session_id as null. Existing attempts remain valid.
alter table public.localization_attempts
  drop constraint localization_attempts_session_id_check;
alter table public.localization_attempts
  add constraint attempts_session_same_map
  foreign key (map_version_id, session_id)
  references public.navigation_sessions(map_version_id, session_id);
create index attempts_session_time_idx
  on public.localization_attempts(session_id, started_at desc);

alter table public.pose_samples
  add column session_id uuid;
alter table public.pose_samples
  alter column provider_pose drop not null;
alter table public.pose_samples
  alter column world_position drop not null;
alter table public.pose_samples
  add constraint poses_session_same_map
  foreign key (map_version_id, session_id)
  references public.navigation_sessions(map_version_id, session_id);
create index pose_samples_session_time_idx
  on public.pose_samples(session_id, captured_at desc);

create table public.simulated_agents (
  agent_id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique,
  map_version_id uuid not null,
  -- A route_id will be added with the stored routes table.
  position jsonb not null check (public.m2_valid_position(position)),
  current_step_index integer check (current_step_index >= 0),
  step_progress_m double precision not null default 0
    check (step_progress_m >= 0 and step_progress_m < 'Infinity'::float8),
  speed_mps double precision not null
    check (speed_mps > 0 and speed_mps < 'Infinity'::float8),
  state text not null default 'idle'
    check (state in ('idle', 'running', 'paused', 'waiting_for_operator', 'arrived', 'unreachable')),
  updated_at timestamptz not null default now() check (isfinite(updated_at)),
  foreign key (map_version_id, session_id)
    references public.navigation_sessions(map_version_id, session_id)
);

-- The destination composite key supports the same-map command constraint.
alter table public.destinations
  add constraint destinations_map_id_unique unique (map_version_id, destination_id);

create table public.robot_commands (
  command_id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  map_version_id uuid not null,
  command text not null
    check (command in ('start', 'pause', 'resume', 'reset', 'set_destination')),
  destination_id uuid,
  issued_at timestamptz not null default now() check (isfinite(issued_at)),
  status text not null default 'pending'
    check (status in ('pending', 'applied', 'rejected')),
  reason text check (reason is null or length(btrim(reason)) between 1 and 1000),
  updated_at timestamptz not null default now() check (isfinite(updated_at)),
  foreign key (map_version_id, session_id)
    references public.navigation_sessions(map_version_id, session_id),
  foreign key (map_version_id, destination_id)
    references public.destinations(map_version_id, destination_id),
  check ((command = 'set_destination') = (destination_id is not null)),
  check (status = 'rejected' or reason is null)
);

create trigger robot_commands_updated_at
  before update on public.robot_commands
  for each row execute function public.m2_touch_updated_at();

-- Robot state and commands must belong to a robot-proxy simulation session.
create function public.m3_require_robot_session() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.navigation_sessions s
    where s.session_id = new.session_id
      and s.map_version_id = new.map_version_id
      and s.agent_type = 'robot_proxy'
      and s.mode = 'simulation'
  ) then
    raise exception 'Robot records require a robot_proxy simulation session'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger simulated_agents_robot_session
  before insert or update of session_id, map_version_id on public.simulated_agents
  for each row execute function public.m3_require_robot_session();
create trigger robot_commands_robot_session
  before insert or update of session_id, map_version_id on public.robot_commands
  for each row execute function public.m3_require_robot_session();

create index robot_commands_session_time_idx
  on public.robot_commands(session_id, issued_at desc);

-- Keep the M3 schema private until authenticated owner/operator write policies
-- and server APIs are reviewed. service_role retains server-side access.
alter table public.navigation_sessions enable row level security;
alter table public.simulated_agents enable row level security;
alter table public.robot_commands enable row level security;
revoke all on public.navigation_sessions, public.simulated_agents,
  public.robot_commands from public, anon, authenticated;
grant select, insert, update, delete on public.navigation_sessions,
  public.simulated_agents, public.robot_commands to service_role;

commit;
