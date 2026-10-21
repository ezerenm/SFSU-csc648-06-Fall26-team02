# M2 live position: evidence

Owner: Sumit. Site: SFSU HSS 349 (Scaniverse VPS map, Production). Pipeline: iPhone (Unity + Niantic NSDK VPS) → `POST /api/poses` → Supabase `pose_samples` → Realtime → `/live`.

## Results (measured in HSS 349)

| Check | Result |
|---|---|
| Localization from different positions | Localized from every corner of the room, each within 10 s |
| Upload reliability | 130 pose posts sent, 0 failed (LAN test over iPhone hotspot, `/live` showed "Live, last update 0.4 s ago") |
| Scale check | 10 floor tiles measured 3.03 m in the app |
| Live dot on `/live` | Dot and heading arrow move with the phone; shows "Not live" when the last sample is older than 5 s |
| Phone → production (Oct 20) | 828 pose samples stored on production across 8 upload periods (separated by gaps of more than 60 s): 4 before class (12:33–12:59) and 4 during the in-class demo (14:03–14:40). The dot updated on production `/live`, on a second phone and on every browser opened (Realtime across clients) |

## Oct 20: phone → production test

- **Morning run failed:** the uploader showed sent 0 and every post failed with "Request timeout" (no HTTP response). VPS tracking was fine. Cause: the app's `uploader.local.json` still had `base_url` set to the laptop's hotspot address from the Oct 15 test, which is unreachable on campus Wi-Fi. Not a server or code problem.
- **Fix:** set `base_url` to `https://sfsu-csc648-06-fall26-team02.vercel.app` and rebuilt the app. Checked the token with an empty-body request: production answered 422 `sample_id must be a uuid`, i.e. the device token was accepted.
- **Result:** after the fix, poses from every upload period reached production. The live dot moved on production `/live`, on another phone and on every browser that had `/live` open. No rows exist from the failed morning run, which matches the timeout cause (no request reached the server).
- **Database record** (screenshot `oct20-pose-samples.png`). Real poses on map `b2000000-0000-4000-8000-000000000001`, device `iphone-sumit`, grouped into upload periods wherever there is a gap of more than 60 s (these are not app-managed navigation sessions). Times are Pacific.

| Period | Poses | Started | Ended | Seconds | When |
|---:|---:|---|---|---:|---|
| 1 | 191 | 12:33:41 | 12:35:56 | 135 | Pre-class test |
| 2 | 17 | 12:38:16 | 12:38:25 | 10 | Pre-class test |
| 3 | 25 | 12:44:01 | 12:44:37 | 36 | Pre-class test |
| 4 | 107 | 12:58:06 | 12:59:06 | 60 | Pre-class test |
| 5 | 56 | 14:03:28 | 14:04:02 | 35 | In-class demo |
| 6 | 375 | 14:28:07 | 14:32:57 | 289 | In-class demo |
| 7 | 50 | 14:35:51 | 14:36:16 | 25 | In-class demo |
| 8 | 7 | 14:40:23 | 14:40:27 | 4 | In-class demo |
| **Total** | **828** | | | | |

The phone sends every 0.5 s only while tracking is valid, so 2 poses/s is the maximum. Upload periods averaged about 1.4 poses/s (0.7–2.0), meaning tracking was not valid for part of each period, or some posts were lost. This is not measured separately in M2; see Known limits.

Query used (Supabase SQL editor):

```sql
with p as (
  select received_at at time zone 'America/Los_Angeles' as t, device_id
  from public.pose_samples
  where map_version_id = 'b2000000-0000-4000-8000-000000000001'
    and data_origin = 'real'
    and received_at >= '2026-10-20 07:00:00+00'
),
l as (select *, lag(t) over (order by t) as prev from p),
g as (
  select *, sum(case when prev is null or t - prev > interval '60 seconds'
                     then 1 else 0 end) over (order by t) as trial
  from l
)
select trial, device_id, count(*) as poses,
       min(t)::time(0) as started, max(t)::time(0) as ended,
       round(extract(epoch from max(t) - min(t))) as seconds
from g group by trial, device_id order by trial;
```
- `uploader.local.json` (holds the device token) is outside the repo and is never committed.

## HSS 349 graph (real, from phone readings)

World frame: right-handed, y up, meters; world z = -(Unity z). Node y = 0.

| Node | Label | x_m | z_m |
|---|---|---:|---:|
| N1 | Door | -4.03 | -2.45 |
| N2 | Back corner (door side) | -1.90 | 3.32 |
| N3 | Back corner (far) | -5.98 | 5.51 |
| N4 | Front of room | -8.46 | 0.11 |

| Segment | Distance (m) |
|---|---:|
| Door to Back corner (door side) | 6.151 |
| Back corner (door side) to Back corner (far) | 4.631 |
| Back corner (far) to Front | 5.942 |
| Front to Door | 5.116 |

Destinations (one per node): Door, Back Corner (Door Side), Back Corner (Far Side), Front of Room. SQL: `app/backend/migrations/hss349_seed.sql`.

## Known limits (not yet verified)

- The z-flip (`world z = -unity z`) is an implementation assumption; direction of travel Door → Front has not been checked by walking it.
- Node coordinates came from single phone readings per corner and may be off by a few tens of centimeters. They are not tape-measured ground truth.
- No screen recording or `/live` screenshot was taken on Oct 20. The database record above shows the poses reached production; that the dot moved on other devices is as observed by the team. A recorded run (phone screen + `/live` side by side) is planned for M3.
- Pose rate below 2/s: the share of time tracking was valid vs. posts lost is not logged yet. M3: log failed posts on the phone and tracking state changes.
- The in-class M2 demo on Oct 20 was in a full room; the live map lagged at times. The `/api/poses` function runs in Vercel's US East region while Supabase is in US West; moving it to `sfo1` is planned for M3.
- The screenshot shows that poses were stored on production. It does not by itself show zero failed uploads, localization accuracy, or continuous movement on every client.
