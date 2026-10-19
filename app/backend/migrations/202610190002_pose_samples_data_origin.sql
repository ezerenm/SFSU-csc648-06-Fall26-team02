-- pose_samples: fake-test poses are synthetic, not real localizations (code review F5).
-- /api/poses now stores data_origin = 'synthetic' for device_id 'fake-test'.
-- This fixes rows already stored and only allows 'real' or 'synthetic' from now on.
-- Run once in the Supabase SQL editor. Safe to re-run.
begin;

update public.pose_samples
set data_origin = 'synthetic'
where device_id = 'fake-test' and data_origin <> 'synthetic';

alter table public.pose_samples drop constraint if exists pose_samples_data_origin_check;
alter table public.pose_samples
  add constraint pose_samples_data_origin_check check (data_origin in ('real', 'synthetic'));

commit;

-- Check: how many rows of each kind.
select device_id, data_origin, count(*) from public.pose_samples group by 1, 2 order by 1, 2;
