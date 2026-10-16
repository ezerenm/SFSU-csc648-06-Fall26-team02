-- HSS 349 seed (M2). Placeholder coordinates, already applied to Supabase.
begin;

insert into public.sites
  (site_id, name, description, is_test_site, is_public_demo, created_at, updated_at)
values
  ('b1000000-0000-4000-8000-000000000001', 'SFSU HSS 349',
   'Front of room HSS 349, scanned with Scaniverse. Real VPS site for the M2 live-position demo.',
   false, true, now(), now())
on conflict (site_id) do nothing;

insert into public.map_versions
  (map_version_id, site_id, version_label, publication_state, world_frame,
   vps_status, current_graph_revision, current_path_state_revision, published_at)
values
  ('b2000000-0000-4000-8000-000000000001',
   'b1000000-0000-4000-8000-000000000001',
   'HSS349-v1', 'published',
   '{"units":"meters","up_axis":"y","handedness":"right","frame_id":"hss349-v1","origin_description":"HSS 349 front of room. Placeholder coordinates until recorded from the phone on site."}'::jsonb,
   'not_configured', 1, 1, now())
on conflict (map_version_id) do nothing;

update public.sites
set active_map_version_id = 'b2000000-0000-4000-8000-000000000001', updated_at = now()
where site_id = 'b1000000-0000-4000-8000-000000000001';

insert into public.graph_nodes (node_id, map_version_id, graph_revision, label, position) values
  ('b3000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000001',1,'N1 Door',    '{"x_m":0,"y_m":0,"z_m":0}'),
  ('b3000000-0000-4000-8000-000000000002','b2000000-0000-4000-8000-000000000001',1,'N2 Aisle',   '{"x_m":0,"y_m":0,"z_m":3}'),
  ('b3000000-0000-4000-8000-000000000003','b2000000-0000-4000-8000-000000000001',1,'N3 Lectern', '{"x_m":3,"y_m":0,"z_m":3}'),
  ('b3000000-0000-4000-8000-000000000004','b2000000-0000-4000-8000-000000000001',1,'N4 AV Rack', '{"x_m":3,"y_m":0,"z_m":6}')
on conflict (node_id) do nothing;

insert into public.path_segments
  (segment_id, map_version_id, graph_revision, label, start_node_id, end_node_id,
   direction, distance_m, geometry, availability, robot_access, last_state_revision, updated_at) values
  ('b4000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000001',1,'Door to Aisle',
   'b3000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000002',
   'bidirectional',3,'[{"x_m":0,"y_m":0,"z_m":0},{"x_m":0,"y_m":0,"z_m":3}]','open','allowed',1,now()),
  ('b4000000-0000-4000-8000-000000000002','b2000000-0000-4000-8000-000000000001',1,'Aisle to Lectern',
   'b3000000-0000-4000-8000-000000000002','b3000000-0000-4000-8000-000000000003',
   'bidirectional',3,'[{"x_m":0,"y_m":0,"z_m":3},{"x_m":3,"y_m":0,"z_m":3}]','open','allowed',1,now()),
  ('b4000000-0000-4000-8000-000000000003','b2000000-0000-4000-8000-000000000001',1,'Lectern to AV Rack',
   'b3000000-0000-4000-8000-000000000003','b3000000-0000-4000-8000-000000000004',
   'bidirectional',3,'[{"x_m":3,"y_m":0,"z_m":3},{"x_m":3,"y_m":0,"z_m":6}]','open','allowed',1,now())
on conflict (segment_id) do nothing;

insert into public.destinations
  (destination_id, site_id, map_version_id, graph_revision, node_id, name, description, is_active, updated_at) values
  ('b5000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000001',1,
   'b3000000-0000-4000-8000-000000000001','Door','Room entrance',true,now()),
  ('b5000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000001',1,
   'b3000000-0000-4000-8000-000000000003','Lectern','Front lectern table',true,now()),
  ('b5000000-0000-4000-8000-000000000003','b1000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000001',1,
   'b3000000-0000-4000-8000-000000000004','AV Rack','AV equipment rack',true,now())
on conflict (destination_id) do nothing;

commit;
