-- HSS 349 v3: move the graph and test points into the v3 scan frame.
-- v3 ("SFSU HSS 349 v3") was generated and set to Production on Nov 5, 2026, replacing v2.
-- v2 node positions do not line up with v3, so the live map was misaligned until this runs.
--
-- Positions come from tape and 12 in floor tiles measured on Nov 5 (distance from the back
-- wall and the window wall), placed on the v3 scan walls (room 9.60 m x 7.64 m, rotated
-- 29.0 deg). Same frame rules as hss349_seed.sql: right-handed, y up, meters,
-- world z = -unity z, node y = 0 (the viewer adds FLOOR_Y).
--
-- Updates rows in place on the existing map version, because the map id is hardcoded in
-- the web app. Node meanings, labels and destinations stay the same.
-- Note: pose_samples saved before Nov 5 on this map id are in the v2 frame.
-- Run once in the Supabase SQL editor. Safe to re-run.
begin;

update public.map_versions
set version_label = 'HSS349-v3',
    world_frame = jsonb_set(jsonb_set(world_frame, '{frame_id}', '"hss349-v3"'),
      '{origin_description}', '"HSS 349 whole room, v3 scan (Nov 5, 2026). VPS map frame."'),
    captured_at = '2026-11-05T12:00:00-08:00'
where map_version_id = 'b2000000-0000-4000-8000-000000000001';

-- Nodes (segment checks are deferred to commit, so nodes and segments can change together).
update public.graph_nodes set label = 'N1 Door', position = '{"x_m":-2.30,"y_m":0,"z_m":3.59}'
where node_id = 'b3000000-0000-4000-8000-000000000001';
update public.graph_nodes set label = 'N2 Back corner (door side)', position = '{"x_m":-7.75,"y_m":0,"z_m":0.22}'
where node_id = 'b3000000-0000-4000-8000-000000000002';
update public.graph_nodes set label = 'N3 Back corner (far)', position = '{"x_m":-5.35,"y_m":0,"z_m":-4.72}'
where node_id = 'b3000000-0000-4000-8000-000000000003';
update public.graph_nodes set label = 'N4 Front of room', position = '{"x_m":0.51,"y_m":0,"z_m":-1.47}'
where node_id = 'b3000000-0000-4000-8000-000000000004';

-- Segments: geometry endpoints must equal the nodes; distance must match within 0.01 m.
update public.path_segments set geometry = '[{"x_m":-2.30,"y_m":0,"z_m":3.59},{"x_m":-7.75,"y_m":0,"z_m":0.22}]', distance_m = 6.408
where segment_id = 'b4000000-0000-4000-8000-000000000001';
update public.path_segments set geometry = '[{"x_m":-7.75,"y_m":0,"z_m":0.22},{"x_m":-5.35,"y_m":0,"z_m":-4.72}]', distance_m = 5.492
where segment_id = 'b4000000-0000-4000-8000-000000000002';
update public.path_segments set geometry = '[{"x_m":-5.35,"y_m":0,"z_m":-4.72},{"x_m":0.51,"y_m":0,"z_m":-1.47}]', distance_m = 6.701
where segment_id = 'b4000000-0000-4000-8000-000000000003';
update public.path_segments set geometry = '[{"x_m":0.51,"y_m":0,"z_m":-1.47},{"x_m":-2.30,"y_m":0,"z_m":3.59}]', distance_m = 5.788
where segment_id = 'b4000000-0000-4000-8000-000000000004';

-- Test points. TP3 and TP4 were measured on Nov 5. TP1, TP2 and TP5 are planned mark
-- positions (marks go down on Nov 10), so they stay unverified until then:
--   TP1: 28.5 tiles from the back wall, 12 tiles 4 in from the window wall
--   TP2: 3 tiles from the back wall, 12 tiles 4 in from the window wall
--   TP5: 16 tiles from the back wall, 12.5 tiles from the window wall
insert into public.test_points
  (test_point_id, map_version_id, label, purpose, reference_position, reference_method,
   reference_uncertainty_m, reference_is_verified, is_synthetic)
values
  ('b6000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'TP1 Front wall middle', 'evaluation',
   '{"x_m":0.06,"y_m":0,"z_m":1.41}', 'Planned mark position from floor tiles; verify after marking on Nov 10', 0.10, false, false),
  ('b6000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000001', 'TP2 Back wall middle', 'evaluation',
   '{"x_m":-6.74,"y_m":0,"z_m":-2.35}', 'Planned mark position from floor tiles; verify after marking on Nov 10', 0.10, false, false),
  ('b6000000-0000-4000-8000-000000000003', 'b2000000-0000-4000-8000-000000000001', 'TP3 Door', 'evaluation',
   '{"x_m":-2.30,"y_m":0,"z_m":3.59}', 'Tape and floor tiles from the back wall and window wall, Nov 5, 2026', 0.10, true, false),
  ('b6000000-0000-4000-8000-000000000004', 'b2000000-0000-4000-8000-000000000001', 'TP4 Back corner (door side)', 'evaluation',
   '{"x_m":-7.75,"y_m":0,"z_m":0.22}', 'Tape and floor tiles from the back wall and window wall, Nov 5, 2026', 0.10, true, false),
  ('b6000000-0000-4000-8000-000000000005', 'b2000000-0000-4000-8000-000000000001', 'TP5 Room center', 'evaluation',
   '{"x_m":-3.30,"y_m":0,"z_m":-0.39}', 'Planned mark position from floor tiles; verify after marking on Nov 10', 0.10, false, false)
on conflict (map_version_id, label) do update
set reference_position = excluded.reference_position,
    reference_method = excluded.reference_method,
    reference_uncertainty_m = excluded.reference_uncertainty_m,
    reference_is_verified = excluded.reference_is_verified;

commit;

-- Check:
-- select label, position from public.graph_nodes where map_version_id = 'b2000000-0000-4000-8000-000000000001' order by label;
-- select label, distance_m from public.path_segments where map_version_id = 'b2000000-0000-4000-8000-000000000001' order by label;
-- select label, reference_position, reference_is_verified from public.test_points
--   where map_version_id = 'b2000000-0000-4000-8000-000000000001' order by label;
