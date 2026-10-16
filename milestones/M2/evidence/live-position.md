# M2 live position: evidence

Owner: Sumit. Site: SFSU HSS 349 (Scaniverse VPS map, Production). Pipeline: iPhone (Unity + Niantic NSDK VPS) → `POST /api/poses` → Supabase `pose_samples` → Realtime → `/live`.

## Results (measured in HSS 349)

| Check | Result |
|---|---|
| Localization from different positions | Localized from every corner of the room, each within 10 s |
| Upload reliability | 130 pose posts sent, 0 failed (LAN test over iPhone hotspot, `/live` showed "Live, last update 0.4 s ago") |
| Scale check | 10 floor tiles measured 3.03 m in the app |
| Live dot on `/live` | Dot and heading arrow move with the phone; shows "Not live" when the last sample is older than 5 s |

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

Destinations: Door, Back Corner (far), Front of Room. SQL: `app/backend/migrations/hss349_seed.sql`.

## Known limits (not yet verified)

- The z-flip (`world z = -unity z`) is an implementation assumption; direction of travel Door → Front has not been checked by walking it.
- Node coordinates came from single phone readings per corner and may be off by a few tens of centimeters. They are not tape-measured ground truth.
- Phone → production Vercel URL has not yet been tested in the room (tests used a laptop on a hotspot).
- Screenshots / demo video are to be attached before submission.
