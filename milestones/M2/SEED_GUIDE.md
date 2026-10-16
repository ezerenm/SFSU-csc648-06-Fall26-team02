# M2 seed template and expected results

Owner: Noah Bran. Data preparation: Tyler Duong.

**Every record in [seed.sql](seed.sql) is synthetic.** These coordinates do not align with an actual campus scan. The success records are invented search examples, not proof of VPS localization or spatial accuracy. No asset, VPS map identity, reference measurement, or orientation is fabricated.

## Using the template

Apply the migration first, then run the seed once in a disposable local database. The SQL is transactional: duplicate IDs or invalid relationships abort the entire import. It does not overwrite existing records. Do not edit shared Supabase data without review and approval.

For a future real-site dataset, copy the template, generate new UUIDs, and record the reviewed map and frame. Set `is_test_site` appropriately and explicitly decide whether the site is a public demo. Do not remove synthetic labels from invented attempts. Real test points must use independently surveyed references; model-picked coordinates are not accuracy ground truth. Real attempts remain private under the current policies.

The example contains 1 site, 1 map version, 8 nodes, 10 segments, 3 destinations, 5 evaluation points and 10 attempts. Both revisions are 1. No verified references or measured errors are supplied.

## Stable identifiers

All UUIDs use this shape: `<prefix>0000000-0000-4000-8000-<12-digit number>`.

| Prefix | Entity | Range |
|---|---|---|
| `1` | Site | 1 |
| `2` | Map | 1 |
| `3` | Nodes N1-N8 | 1-8 |
| `4` | Segments S1-S10 | 1-10 |
| `5` | Destinations | 1 = Room 103; 2 = Lobby; 3 = East room |
| `6` | Test points TP1-TP5 | 1-5 |
| `7` | Attempts | 1-10 |

Example map ID: `20000000-0000-4000-8000-000000000001`.

## Coordinates and edges

Coordinates are meters in a right-handed frame; Y is up. All sample nodes lie on Y=0. The invented +X/+Z directions have no geographic or VPS meaning.

| Node | Label | X | Y | Z |
|---|---|---:|---:|---:|
| N1 | Entrance | 0 | 0 | 0 |
| N2 | Junction | 0 | 0 | 4 |
| N3 | Room 103 | 4 | 0 | 4 |
| N4 | North turn | 0 | 0 | 8 |
| N5 | Upper junction | 4 | 0 | 8 |
| N6 | Lobby | 8 | 0 | 8 |
| N7 | East junction | 8 | 0 | 4 |
| N8 | East room | 12 | 0 | 4 |

| Segment | Endpoints | Distance | Direction | Availability | Robot access |
|---|---|---:|---|---|---|
| S1 | N1-N2 | 4 m | Both | Open | Allowed |
| S2 | N2-N3 | 4 m | Both | Open | Restricted |
| S3 | N2-N4 | 4 m | Both | Open | Allowed |
| S4 | N4-N5 | 4 m | Both | Open | Allowed |
| S5 | N5-N3 | 4 m | N5 to N3 only | Open | Allowed |
| S6 | N5-N6 | 4 m | Both | Open | Allowed |
| S7 | N6-N7 | 4 m | Both | Open | Allowed |
| S8 | N3-N7 | 4 m | Both | Open | Allowed |
| S9 | N7-N8 | 4 m | Both | Closed | Allowed |
| S10 | N1-N4 | 8 m | Both | Closed | Restricted |

## Hand-calculated routing expectations

These are synthetic fixtures. Sumit's function and the backend route adapter pass all four expectations locally. Human, robot and unreachable routes also passed through local HTTP against the shared Supabase graph.

| Request | Expected result |
|---|---|
| N1 to Room 103, human | N1 → N2 → N3; S1, S2; 8 m |
| N1 to Room 103, robot | N1 → N2 → N4 → N5 → N3; S1, S3, S4, S5; 16 m |
| N1 to East room, either profile | `unreachable`, empty steps, null distance; S9 is closed |
| N3 to Room 103 | `valid`, empty steps, distance 0 |
| N3 to N5, human (function-level test) | S5 cannot be traversed backward; shortest permitted distance is 12 m |

Routes to the Lobby may have equal-cost alternatives. The function should break ties deterministically, but correctness tests may accept any permitted shortest path unless a tie rule has been agreed. No sample route may use closed segments. Reopening S10 must preserve `robot_access = restricted`.

## Attempt search expectations

Each test point has two attempts. All have `mode = simulation`, `data_origin = synthetic`, null SDK/pose/error fields, and `error_is_valid = false`.

| Point | Attempt numbers | Outcomes |
|---|---|---|
| TP1 | 1, 2 | success, success |
| TP2 | 3, 4 | success, timeout |
| TP3 | 5, 6 | tracking_loss, network_error |
| TP4 | 7, 8 | success, map_mismatch |
| TP5 | 9, 10 | cancelled, other_failure |

- No filters: 10 attempts, newest first (attempt 10 through 1).
- `outcome=success`: 4 attempts (7, 3, 2, 1).
- TP2 plus `outcome=timeout`: attempt 4 only.
- `q=tp3`: 2 attempts; label matching is case-insensitive.
- TP5 plus `outcome=success`, or `outcome=in_progress`: `items: []`, `total: 0`.
- `limit=3&offset=0`: attempts 10, 9, 8, with `total: 10`.
- An offset beyond the end returns an empty page and retains the filtered total.

There are 8 open and 2 closed segments in the graph response. A separate path-segment search endpoint is a bonus in the team plan and is not implemented.
