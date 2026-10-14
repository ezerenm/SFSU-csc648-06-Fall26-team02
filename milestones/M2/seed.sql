-- SYNTHETIC M2 SAMPLE DATA: not an SFSU survey, scan alignment, or VPS evidence.
-- Tyler: copy this template for reviewed site data; keep synthetic records labeled.
-- Apply once to a local/disposable database after the M2 migration.
-- Duplicate IDs cause a rollback; this file never overwrites existing records.
begin;
insert into public.sites (site_id,name,description,is_test_site,is_public_demo) values ('10000000-0000-4000-8000-000000000001','SYNTHETIC M2 demo','Invented coordinates and attempts for development; not a real campus scan.',true,true);
insert into public.map_versions (map_version_id,site_id,version_label,publication_state,world_frame,published_at) values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','SYNTHETIC-v1','published','{"frame_id":"synthetic-m2-world-v1","origin_description":"Invented entrance at (0,0,0); +X toward sample east corridor, +Z toward sample north corridor. Not geographic east/north.","handedness":"right","up_axis":"y","units":"meters"}'::jsonb,'2026-10-11T12:00:00Z');
update public.sites set active_map_version_id='20000000-0000-4000-8000-000000000001' where site_id='10000000-0000-4000-8000-000000000001';

-- Eight nodes; labels keep N1-N8 for hand calculations. UUIDs are the actual IDs.
insert into public.graph_nodes (node_id,map_version_id,label,position) values
('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','N1 Entrance','{"x_m":0,"y_m":0,"z_m":0}'::jsonb),
('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','N2 Junction','{"x_m":0,"y_m":0,"z_m":4}'::jsonb),
('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','N3 Room 103','{"x_m":4,"y_m":0,"z_m":4}'::jsonb),
('30000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001','N4 North turn','{"x_m":0,"y_m":0,"z_m":8}'::jsonb),
('30000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000001','N5 Upper junction','{"x_m":4,"y_m":0,"z_m":8}'::jsonb),
('30000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000001','N6 Lobby','{"x_m":8,"y_m":0,"z_m":8}'::jsonb),
('30000000-0000-4000-8000-000000000007','20000000-0000-4000-8000-000000000001','N7 East junction','{"x_m":8,"y_m":0,"z_m":4}'::jsonb),
('30000000-0000-4000-8000-000000000008','20000000-0000-4000-8000-000000000001','N8 East room','{"x_m":12,"y_m":0,"z_m":4}'::jsonb);

-- Geometry is always ordered start -> end; distance equals polyline length.
insert into public.path_segments (segment_id,map_version_id,label,start_node_id,end_node_id,distance_m,direction,availability,robot_access,geometry) values
('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','S1 N1 to N2','30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002',4,'bidirectional','open','allowed','[{"x_m":0,"y_m":0,"z_m":0},{"x_m":0,"y_m":0,"z_m":4}]'::jsonb),
('40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','S2 N2 to N3','30000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000003',4,'bidirectional','open','restricted','[{"x_m":0,"y_m":0,"z_m":4},{"x_m":4,"y_m":0,"z_m":4}]'::jsonb),
('40000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','S3 N2 to N4','30000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000004',4,'bidirectional','open','allowed','[{"x_m":0,"y_m":0,"z_m":4},{"x_m":0,"y_m":0,"z_m":8}]'::jsonb),
('40000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001','S4 N4 to N5','30000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000005',4,'bidirectional','open','allowed','[{"x_m":0,"y_m":0,"z_m":8},{"x_m":4,"y_m":0,"z_m":8}]'::jsonb),
('40000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000001','S5 N5 to N3','30000000-0000-4000-8000-000000000005','30000000-0000-4000-8000-000000000003',4,'start_to_end','open','allowed','[{"x_m":4,"y_m":0,"z_m":8},{"x_m":4,"y_m":0,"z_m":4}]'::jsonb),
('40000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000001','S6 N5 to N6','30000000-0000-4000-8000-000000000005','30000000-0000-4000-8000-000000000006',4,'bidirectional','open','allowed','[{"x_m":4,"y_m":0,"z_m":8},{"x_m":8,"y_m":0,"z_m":8}]'::jsonb),
('40000000-0000-4000-8000-000000000007','20000000-0000-4000-8000-000000000001','S7 N6 to N7','30000000-0000-4000-8000-000000000006','30000000-0000-4000-8000-000000000007',4,'bidirectional','open','allowed','[{"x_m":8,"y_m":0,"z_m":8},{"x_m":8,"y_m":0,"z_m":4}]'::jsonb),
('40000000-0000-4000-8000-000000000008','20000000-0000-4000-8000-000000000001','S8 N3 to N7','30000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000007',4,'bidirectional','open','allowed','[{"x_m":4,"y_m":0,"z_m":4},{"x_m":8,"y_m":0,"z_m":4}]'::jsonb),
('40000000-0000-4000-8000-000000000009','20000000-0000-4000-8000-000000000001','S9 N7 to N8','30000000-0000-4000-8000-000000000007','30000000-0000-4000-8000-000000000008',4,'bidirectional','closed','allowed','[{"x_m":8,"y_m":0,"z_m":4},{"x_m":12,"y_m":0,"z_m":4}]'::jsonb),
('40000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000001','S10 N1 to N4','30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000004',8,'bidirectional','closed','restricted','[{"x_m":0,"y_m":0,"z_m":0},{"x_m":0,"y_m":0,"z_m":8}]'::jsonb);

insert into public.destinations (destination_id,site_id,map_version_id,node_id,name,description) values
('50000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000003','Room 103','Synthetic destination; human and robot routes differ.'),
('50000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000006','Lobby','Synthetic destination.'),
('50000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000008','East room','Synthetic unreachable destination while S9 is closed.');

-- No independently measured references: never invent verified coordinates or accuracy.
insert into public.test_points (test_point_id,map_version_id,label,purpose,is_synthetic) values
('60000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','TP1 SYNTHETIC','evaluation',true),
('60000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','TP2 SYNTHETIC','evaluation',true),
('60000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','TP3 SYNTHETIC','evaluation',true),
('60000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001','TP4 SYNTHETIC','evaluation',true),
('60000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000001','TP5 SYNTHETIC','evaluation',true);

-- Four synthetic successes and six synthetic failures. All use simulation mode.
-- These rows provide search fixtures only; success here does not prove phone localization.
insert into public.localization_attempts (attempt_id,map_version_id,test_point_id,device_id,mode,data_origin,condition_label,camera_direction,started_at,ended_at,outcome,latency_ms,failure_reason) values
('70000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','synthetic-iphone-fixture','simulation','synthetic','SYNTHETIC daylight','synthetic +Z','2026-10-11T12:01:00Z','2026-10-11T12:01:02Z','success',2000,null),
('70000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','synthetic-iphone-fixture','simulation','synthetic','SYNTHETIC evening','synthetic +Z','2026-10-11T12:02:00Z','2026-10-11T12:02:02Z','success',2000,null),
('70000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000002','synthetic-iphone-fixture','simulation','synthetic','SYNTHETIC daylight','synthetic +Z','2026-10-11T12:03:00Z','2026-10-11T12:03:02Z','success',2000,null),
('70000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000002','synthetic-iphone-fixture','simulation','synthetic','SYNTHETIC evening','synthetic +Z','2026-10-11T12:04:00Z','2026-10-11T12:04:30Z','timeout',null,'SYNTHETIC timeout example'),
('70000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000003','synthetic-iphone-fixture','simulation','synthetic','SYNTHETIC daylight','synthetic +Z','2026-10-11T12:05:00Z','2026-10-11T12:05:05Z','tracking_loss',null,'SYNTHETIC tracking_loss example'),
('70000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000003','synthetic-iphone-fixture','simulation','synthetic','SYNTHETIC evening','synthetic +Z','2026-10-11T12:06:00Z','2026-10-11T12:06:05Z','network_error',null,'SYNTHETIC network_error example'),
('70000000-0000-4000-8000-000000000007','20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000004','synthetic-iphone-fixture','simulation','synthetic','SYNTHETIC daylight','synthetic +Z','2026-10-11T12:07:00Z','2026-10-11T12:07:02Z','success',2000,null),
('70000000-0000-4000-8000-000000000008','20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000004','synthetic-iphone-fixture','simulation','synthetic','SYNTHETIC evening','synthetic +Z','2026-10-11T12:08:00Z','2026-10-11T12:08:05Z','map_mismatch',null,'SYNTHETIC map_mismatch example'),
('70000000-0000-4000-8000-000000000009','20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000005','synthetic-iphone-fixture','simulation','synthetic','SYNTHETIC daylight','synthetic +Z','2026-10-11T12:09:00Z','2026-10-11T12:09:05Z','cancelled',null,'SYNTHETIC cancelled example'),
('70000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000005','synthetic-iphone-fixture','simulation','synthetic','SYNTHETIC evening','synthetic +Z','2026-10-11T12:10:00Z','2026-10-11T12:10:05Z','other_failure',null,'SYNTHETIC other_failure example');

commit;
