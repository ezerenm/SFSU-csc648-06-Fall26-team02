-- HSS 349: every graph node is a destination (4 total) and names use one style.
-- Needed because hss349_seed.sql uses ON CONFLICT DO NOTHING, so editing it does not
-- change rows that already exist in Supabase. Run once in the Supabase SQL editor.
-- Safe to re-run.
begin;

update public.destinations
set name = 'Back Corner (Far Side)',
    description = 'Back corner of the room, far from the door'
where destination_id = 'b5000000-0000-4000-8000-000000000002';

insert into public.destinations
  (destination_id, site_id, map_version_id, graph_revision, node_id, name, description, is_active, updated_at)
values
  ('b5000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000001',
   'b2000000-0000-4000-8000-000000000001', 1, 'b3000000-0000-4000-8000-000000000002',
   'Back Corner (Door Side)', 'Back corner of the room on the door side', true, now())
on conflict (destination_id) do nothing;

commit;

-- Check: should return 4 rows (Back Corner (Door Side), Back Corner (Far Side), Door, Front of Room).
-- select name, node_id from public.destinations
-- where map_version_id = 'b2000000-0000-4000-8000-000000000001' and is_active order by name;
