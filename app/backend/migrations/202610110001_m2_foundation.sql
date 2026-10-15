-- M2 shared backend foundation. Apply once after the existing schema.sql.
-- Additive migration; no existing tables or data are replaced.
begin;

create function public.m2_valid_position(value jsonb) returns boolean
language sql immutable parallel safe set search_path = '' as $$
  select coalesce(
    jsonb_typeof(value) = 'object'
    and value - array['x_m', 'y_m', 'z_m'] = '{}'::jsonb
    and case when jsonb_typeof(value->'x_m') = 'number'
                  and jsonb_typeof(value->'y_m') = 'number'
                  and jsonb_typeof(value->'z_m') = 'number'
      then abs((value->>'x_m')::numeric) <= 1000000
       and abs((value->>'y_m')::numeric) <= 1000000
       and abs((value->>'z_m')::numeric) <= 1000000
      else false end, false);
$$;

create function public.m2_valid_geometry(value jsonb) returns boolean
language sql immutable parallel safe set search_path = '' as $$
  select case when jsonb_typeof(value) = 'array' then
    jsonb_array_length(value) between 2 and 1000
    and not exists (select 1 from jsonb_array_elements(value) p
                    where not public.m2_valid_position(p))
    else false end;
$$;

create table public.sites (
  site_id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  description text not null default '' check (length(description) <= 1000),
  is_test_site boolean not null default false,
  is_public_demo boolean not null default false,
  active_map_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.map_versions (
  map_version_id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(site_id),
  version_label text not null check (length(btrim(version_label)) between 1 and 120),
  publication_state text not null default 'draft'
    check (publication_state in ('draft', 'published', 'retired')),
  world_frame jsonb not null,
  -- Asset registry is planned for M3. M2 uses a reviewed map-keyed config file.
  visual_asset_id uuid check (visual_asset_id is null),
  vps_map_id text check (length(btrim(vps_map_id)) between 1 and 1000),
  vps_status text not null default 'not_configured'
    check (vps_status in ('not_configured', 'draft', 'production', 'unavailable')),
  current_graph_revision integer not null default 1 check (current_graph_revision > 0),
  current_path_state_revision integer not null default 1 check (current_path_state_revision > 0),
  captured_at timestamptz,
  published_at timestamptz,
  unique (site_id, version_label),
  unique (site_id, map_version_id),
  constraint map_world_frame check (coalesce(
    jsonb_typeof(world_frame) = 'object'
    and jsonb_typeof(world_frame->'frame_id') = 'string'
    and length(btrim(world_frame->>'frame_id')) between 1 and 120
    and jsonb_typeof(world_frame->'origin_description') = 'string'
    and length(btrim(world_frame->>'origin_description')) between 1 and 1000
    and world_frame->>'handedness' = 'right'
    and world_frame->>'up_axis' = 'y'
    and world_frame->>'units' = 'meters', false)),
  check (publication_state <> 'published' or published_at is not null),
  check (vps_status not in ('draft', 'production') or vps_map_id is not null)
);

alter table public.sites add constraint site_active_map_same_site
  foreign key (site_id, active_map_version_id)
  references public.map_versions(site_id, map_version_id);

create table public.graph_nodes (
  node_id uuid primary key default gen_random_uuid(),
  map_version_id uuid not null references public.map_versions(map_version_id),
  graph_revision integer not null default 1 check (graph_revision > 0),
  label text not null check (length(btrim(label)) between 1 and 120),
  position jsonb not null check (public.m2_valid_position(position)),
  unique (map_version_id, graph_revision, node_id)
);

create table public.path_segments (
  segment_id uuid primary key default gen_random_uuid(),
  map_version_id uuid not null references public.map_versions(map_version_id),
  graph_revision integer not null default 1 check (graph_revision > 0),
  label text not null check (length(btrim(label)) between 1 and 120),
  start_node_id uuid not null,
  end_node_id uuid not null,
  direction text not null default 'bidirectional'
    check (direction in ('bidirectional', 'start_to_end')),
  distance_m double precision not null check (distance_m > 0 and distance_m < 'Infinity'::float8),
  geometry jsonb not null check (public.m2_valid_geometry(geometry)),
  availability text not null default 'open' check (availability in ('open', 'closed')),
  robot_access text not null default 'allowed' check (robot_access in ('allowed', 'restricted')),
  last_state_revision integer not null default 1 check (last_state_revision > 0),
  updated_at timestamptz not null default now(),
  check (start_node_id <> end_node_id),
  foreign key (map_version_id, graph_revision, start_node_id)
    references public.graph_nodes(map_version_id, graph_revision, node_id),
  foreign key (map_version_id, graph_revision, end_node_id)
    references public.graph_nodes(map_version_id, graph_revision, node_id)
);

create table public.destinations (
  destination_id uuid primary key default gen_random_uuid(),
  site_id uuid not null,
  map_version_id uuid not null,
  -- Additive field to enforce the same graph revision as the destination node.
  graph_revision integer not null default 1 check (graph_revision > 0),
  node_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 120),
  description text not null default '' check (length(description) <= 1000),
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  foreign key (site_id, map_version_id) references public.map_versions(site_id, map_version_id),
  foreign key (map_version_id, graph_revision, node_id)
    references public.graph_nodes(map_version_id, graph_revision, node_id)
);

create table public.test_points (
  test_point_id uuid primary key default gen_random_uuid(),
  map_version_id uuid not null references public.map_versions(map_version_id),
  label text not null check (length(btrim(label)) between 1 and 120),
  purpose text not null default 'evaluation' check (purpose in ('evaluation', 'alignment')),
  reference_position jsonb check (reference_position is null or public.m2_valid_position(reference_position)),
  reference_method text check (length(btrim(reference_method)) between 1 and 1000),
  reference_uncertainty_m double precision
    check (reference_uncertainty_m >= 0 and reference_uncertainty_m < 'Infinity'::float8),
  reference_is_verified boolean not null default false,
  is_synthetic boolean not null default false,
  unique (map_version_id, test_point_id),
  unique (map_version_id, label),
  check (not reference_is_verified or
    (not is_synthetic and reference_position is not null and reference_method is not null
     and reference_uncertainty_m is not null))
);

create table public.localization_attempts (
  attempt_id uuid primary key default gen_random_uuid(),
  session_id uuid check (session_id is null),
  map_version_id uuid not null,
  test_point_id uuid not null,
  device_id text not null check (length(btrim(device_id)) between 1 and 120),
  sdk_version text check (length(btrim(sdk_version)) between 1 and 120),
  mode text not null check (mode in ('live', 'simulation', 'replay')),
  data_origin text not null check (data_origin in ('live_sdk', 'synthetic', 'recorded')),
  condition_label text not null check (length(btrim(condition_label)) between 1 and 120),
  camera_direction text not null check (length(btrim(camera_direction)) between 1 and 120),
  started_at timestamptz not null check (isfinite(started_at)),
  ended_at timestamptz check (isfinite(ended_at)),
  outcome text not null check (outcome in
    ('in_progress', 'success', 'timeout', 'tracking_loss', 'network_error', 'map_mismatch', 'cancelled', 'other_failure')),
  latency_ms double precision,
  failure_reason text check (length(btrim(failure_reason)) between 1 and 1000),
  valid_pose_sample_id uuid check (valid_pose_sample_id is null),
  -- Verified pose/reference error ingestion is deferred; do not imply measured accuracy.
  horizontal_error_m double precision check (horizontal_error_m is null),
  error_is_valid boolean not null default false check (not error_is_valid),
  received_at timestamptz not null default now() check (isfinite(received_at)),
  foreign key (map_version_id, test_point_id) references public.test_points(map_version_id, test_point_id),
  check ((mode = 'live' and data_origin = 'live_sdk' and sdk_version is not null)
      or (mode = 'simulation' and data_origin = 'synthetic' and sdk_version is null)
      or (mode = 'replay' and data_origin = 'recorded')),
  check ((outcome = 'in_progress' and ended_at is null and latency_ms is null and failure_reason is null)
      or (outcome = 'success' and ended_at is not null and latency_ms is not null
          and latency_ms between 0 and 30000 and failure_reason is null
          and ended_at - started_at <= interval '30 seconds'
          and latency_ms <= extract(epoch from (ended_at - started_at)) * 1000)
      or (outcome not in ('in_progress', 'success') and ended_at is not null
          and latency_ms is null and failure_reason is not null)),
  check (ended_at is null or ended_at >= started_at),
  check (outcome <> 'timeout' or ended_at - started_at >= interval '30 seconds')
);

create index map_versions_publication_idx on public.map_versions(site_id, publication_state);
create index path_segments_map_revision_idx on public.path_segments(map_version_id, graph_revision);
create index path_segments_start_idx on public.path_segments(start_node_id);
create index path_segments_end_idx on public.path_segments(end_node_id);
create index destinations_node_idx on public.destinations(node_id);
create index destinations_map_revision_idx on public.destinations(map_version_id, graph_revision);
create index attempts_map_time_idx on public.localization_attempts(map_version_id, started_at desc, attempt_id);
create index attempts_point_outcome_idx on public.localization_attempts(map_version_id, test_point_id, outcome, started_at desc);
create index attempts_outcome_idx on public.localization_attempts(map_version_id, outcome, started_at desc);

create function public.m2_touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger sites_updated_at before update on public.sites
  for each row execute function public.m2_touch_updated_at();
create trigger segments_updated_at before update on public.path_segments
  for each row execute function public.m2_touch_updated_at();
create trigger destinations_updated_at before update on public.destinations
  for each row execute function public.m2_touch_updated_at();

-- The default map may be unset, but must never point to a draft or retired map.
create function public.m2_check_active_map() returns trigger
language plpgsql set search_path = '' as $$
begin
  if exists (
    select 1 from public.sites s
    join public.map_versions m on m.map_version_id = s.active_map_version_id
    where s.site_id = (to_jsonb(new)->>'site_id')::uuid
      and m.publication_state <> 'published'
  ) then
    raise exception 'An active map must be published' using errcode = '23514';
  end if;
  return null;
end;
$$;
create constraint trigger sites_active_map_published after insert or update on public.sites
  deferrable initially deferred for each row execute function public.m2_check_active_map();
create constraint trigger maps_active_map_published after update on public.map_versions
  deferrable initially deferred for each row execute function public.m2_check_active_map();

-- Geometry follows start -> end, including on bidirectional edges. Deferred checks
-- allow a maintainer to move a node and update its connected paths in one transaction.
create function public.m2_check_segment_geometry() returns trigger
language plpgsql set search_path = '' as $$
declare
  segment record;
  polyline_length double precision;
begin
  for segment in
    select s.*, a.position as start_position, b.position as end_position
    from public.path_segments s
    join public.graph_nodes a on a.node_id = s.start_node_id
    join public.graph_nodes b on b.node_id = s.end_node_id
    where (tg_table_name = 'path_segments' and s.segment_id = (to_jsonb(new)->>'segment_id')::uuid)
       or (tg_table_name = 'graph_nodes' and (s.start_node_id = (to_jsonb(new)->>'node_id')::uuid
                                             or s.end_node_id = (to_jsonb(new)->>'node_id')::uuid))
  loop
    if segment.geometry->0 <> segment.start_position or segment.geometry->-1 <> segment.end_position then
      raise exception 'Segment geometry endpoints must match its nodes' using errcode = '23514';
    end if;
    select sum(sqrt(power((p->>'x_m')::float8 - (previous->>'x_m')::float8, 2)
                  + power((p->>'y_m')::float8 - (previous->>'y_m')::float8, 2)
                  + power((p->>'z_m')::float8 - (previous->>'z_m')::float8, 2)))
      into polyline_length
      from (select p, lag(p) over (order by ordinal) as previous
            from jsonb_array_elements(segment.geometry) with ordinality as points(p, ordinal)) lengths;
    if abs(segment.distance_m - polyline_length) > 0.01 then
      raise exception 'Segment distance must match its geometry length within 0.01 meter' using errcode = '23514';
    end if;
  end loop;
  return null;
end;
$$;
create constraint trigger segments_geometry_consistent after insert or update on public.path_segments
  deferrable initially deferred for each row execute function public.m2_check_segment_geometry();
create constraint trigger nodes_geometry_consistent after update on public.graph_nodes
  deferrable initially deferred for each row execute function public.m2_check_segment_geometry();

alter table public.sites enable row level security;
alter table public.map_versions enable row level security;
alter table public.graph_nodes enable row level security;
alter table public.path_segments enable row level security;
alter table public.destinations enable row level security;
alter table public.test_points enable row level security;
alter table public.localization_attempts enable row level security;

-- Public visibility is an explicit site opt-in AND requires a published map.
-- Policies apply equally to anonymous and signed-in users; no app writes in M2.
create policy m2_demo_sites on public.sites for select to anon, authenticated
  using (is_public_demo);
create policy m2_published_maps on public.map_versions for select to anon, authenticated
  using (publication_state = 'published' and exists
    (select 1 from public.sites s where s.site_id = map_versions.site_id and s.is_public_demo));
create policy m2_demo_nodes on public.graph_nodes for select to anon, authenticated
  using (exists (select 1 from public.map_versions m where m.map_version_id = graph_nodes.map_version_id
                and m.current_graph_revision = graph_nodes.graph_revision));
create policy m2_demo_segments on public.path_segments for select to anon, authenticated
  using (exists (select 1 from public.map_versions m where m.map_version_id = path_segments.map_version_id
                and m.current_graph_revision = path_segments.graph_revision));
create policy m2_demo_destinations on public.destinations for select to anon, authenticated
  using (is_active and exists (select 1 from public.map_versions m where m.map_version_id = destinations.map_version_id
                and m.current_graph_revision = destinations.graph_revision));
create policy m2_synthetic_points on public.test_points for select to anon, authenticated
  using (is_synthetic and exists
    (select 1 from public.map_versions m where m.map_version_id = test_points.map_version_id));
create policy m2_synthetic_attempts on public.localization_attempts for select to anon, authenticated
  using (data_origin = 'synthetic' and exists (select 1 from public.test_points t
    where t.test_point_id = localization_attempts.test_point_id and t.map_version_id = localization_attempts.map_version_id));

revoke all on public.sites, public.map_versions, public.graph_nodes, public.path_segments,
  public.destinations, public.test_points, public.localization_attempts from public, anon, authenticated;
grant select on public.sites, public.map_versions, public.graph_nodes, public.path_segments,
  public.destinations, public.test_points, public.localization_attempts to anon, authenticated;
-- Maintenance only; this role's key must never be used by the public M2 API.
grant all on public.sites, public.map_versions, public.graph_nodes, public.path_segments,
  public.destinations, public.test_points, public.localization_attempts to service_role;

-- One SQL statement gives graph metadata and arrays from one database snapshot.
-- Invoker rights retain RLS. Explicit fields avoid leaking future private columns.
create function public.m2_get_graph(requested_map_version_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'site', jsonb_build_object('site_id', s.site_id, 'name', s.name, 'is_test_site', s.is_test_site),
    'map_version', jsonb_build_object('map_version_id', m.map_version_id, 'site_id', m.site_id,
      'version_label', m.version_label, 'world_frame', m.world_frame,
      'current_graph_revision', m.current_graph_revision, 'current_path_state_revision', m.current_path_state_revision),
    'nodes', coalesce((select jsonb_agg(jsonb_build_object('node_id', n.node_id,
      'map_version_id', n.map_version_id, 'graph_revision', n.graph_revision, 'label', n.label, 'position', n.position)
      order by n.label, n.node_id) from public.graph_nodes n where n.map_version_id = m.map_version_id
      and n.graph_revision = m.current_graph_revision), '[]'::jsonb),
    'segments', coalesce((select jsonb_agg(jsonb_build_object('segment_id', e.segment_id,
      'map_version_id', e.map_version_id, 'graph_revision', e.graph_revision, 'label', e.label,
      'start_node_id', e.start_node_id, 'end_node_id', e.end_node_id, 'direction', e.direction,
      'distance_m', e.distance_m, 'geometry', e.geometry, 'availability', e.availability,
      'robot_access', e.robot_access, 'last_state_revision', e.last_state_revision)
      order by e.label, e.segment_id) from public.path_segments e where e.map_version_id = m.map_version_id
      and e.graph_revision = m.current_graph_revision), '[]'::jsonb),
    'destinations', coalesce((select jsonb_agg(jsonb_build_object('destination_id', d.destination_id,
      'site_id', d.site_id, 'map_version_id', d.map_version_id, 'graph_revision', d.graph_revision,
      'node_id', d.node_id, 'name', d.name, 'description', d.description, 'is_active', d.is_active)
      order by d.name, d.destination_id) from public.destinations d where d.map_version_id = m.map_version_id
      and d.graph_revision = m.current_graph_revision and d.is_active), '[]'::jsonb),
    'test_points', coalesce((select jsonb_agg(jsonb_build_object('test_point_id', t.test_point_id,
      'map_version_id', t.map_version_id, 'label', t.label, 'purpose', t.purpose, 'is_synthetic', t.is_synthetic)
      order by t.label, t.test_point_id) from public.test_points t where t.map_version_id = m.map_version_id
      and t.is_synthetic), '[]'::jsonb)
  ) from public.map_versions m join public.sites s on s.site_id = m.site_id
    where m.map_version_id = requested_map_version_id and m.publication_state = 'published' and s.is_public_demo;
$$;

revoke all on function public.m2_get_graph(uuid) from public;
grant execute on function public.m2_get_graph(uuid) to anon, authenticated, service_role;
revoke all on function public.m2_touch_updated_at(), public.m2_check_segment_geometry(), public.m2_check_active_map() from public;
comment on column public.sites.is_public_demo is 'Explicit opt-in for public M2 graph reads; does not expose live trial data.';
comment on column public.map_versions.visual_asset_id is 'Reserved null until the M3 asset registry exists.';
comment on table public.localization_attempts is 'M2 list/search prototype. Synthetic attempts are not VPS evidence; live ingestion and verified error measurement are deferred.';

commit;
