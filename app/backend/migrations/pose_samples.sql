-- pose_samples: live phone position (M2). Already applied to Supabase csc648-team02.
create table public.pose_samples (
  sample_id        uuid primary key default gen_random_uuid(),
  map_version_id   uuid not null references public.map_versions(map_version_id),
  attempt_id       uuid references public.localization_attempts(attempt_id),
  device_id        text not null,
  provider_map_id  text,
  provider_pose    jsonb not null,
  world_position   jsonb,
  heading_deg      double precision,
  tracking_status  text not null
    check (tracking_status in ('localizing','valid','lost')),
  data_origin      text not null default 'real',
  captured_at      timestamptz not null,
  received_at      timestamptz not null default now()
);

create index pose_samples_live_idx
  on public.pose_samples (map_version_id, captured_at desc);

alter table public.pose_samples enable row level security;

create policy m2_demo_poses on public.pose_samples
  for select to anon, authenticated using (true);

alter publication supabase_realtime add table public.pose_samples;
