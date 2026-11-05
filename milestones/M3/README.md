# Milestone 3: Demo, Frozen Priority 1 List and Appendix I

**SpatialOS** · SW Engineering CSC 648/848 · Section 06, Team 02 · Demo November 3, 2026 · Appendix I submitted November 4, 2026

| | |
|---|---|
| **Appendix I** | [SpatialOS_M3_AppendixI_Section06_Team02.pdf](SpatialOS_M3_AppendixI_Section06_Team02.pdf) ([.docx](SpatialOS_M3_AppendixI_Section06_Team02.docx)) |
| **Production site** | <https://sfsu-csc648-06-fall26-team02.vercel.app> (deployed from `main`) |
| **Previous milestone** | [Milestone 2](../M2/README.md) |

## Contents

| Path | What it is |
|---|---|
| [`SpatialOS_M3_AppendixI_Section06_Team02.pdf`](SpatialOS_M3_AppendixI_Section06_Team02.pdf) | **Submitted Appendix I.** Item 1: instructor feedback, demo record, UI and usability changes, action plan. Item 2: frozen Priority 1 list. Item 3: UML. Item 4: actual risks. |
| [`uml/`](uml/) | Sources and images for the Item 3 diagrams, with re-render commands |

## Status

| Measure | Result |
|---|---|
| Priority 1 working on demo day (Nov 3 list, 47 items) | 36 (76.6%) |
| Frozen Priority 1 list (Nov 4, 51 items) | 36 done (70.6%), 5 partial, 10 not started |
| Partial | R3.4, R5.6, R8.3, R10.1, R11.1 |
| Not started | R1.1 to R1.4 (accounts), R12.1 to R12.4 (attempt logging, live capture, failure list), R13.1, R13.2 (charts) |

After the M3 review the main point of the project is **data and localization accuracy**. Navigation stays as built and drives the data collection runs; visitor iOS navigation (R20) moved to Priority 2, and the 3D view is the one map view. The 2-week collection plan (Nov 5 to 18) is in Appendix I, Item 1.

## What M3 added

| PR | What | Requirements |
|---|---|---|
| #47, #48, #49 | Live map status chip, segment attach and start rules, real phone IDs, polling fallback | R4.1, R4.2, R6.2.1 to R6.4, R19 |
| #56 | "Timed out, try again" after 30 s localizing | R3.4 |
| #57 | M3 schema: navigation sessions, simulated agents, robot commands, live attempts and real test points readable on public demo maps | R10, R11.1, R12, R14.3 |
| #58 | Localization health per test point (`GET /api/health`) | R14.1 to R14.5 |
| #60, #61 | Gemini health summary with every number checked, `/health` page with Explain with AI | R16.1 |
| #62 | Rerouting on `/live` when a path segment changes | R8.3, R9.1, R9.3 |
| #64 | Simulated robot route on robot-allowed segments, with rerouting | R5.6, R9.2, R10.2, R10.3, R17.1 |
| #65 | Phone sends localizing and lost, 30 s timeout with Retry | R3.4, R4.1 |
| #67, #69 | `/operator` page: live map plus Close, Reopen, Humans only, Allow robots (`PATCH /api/segments`) | R8.1, R8.2, R17.1, R17.2, R19 |

## Pages and APIs

| Page | Purpose |
|---|---|
| `/` | Home, list and search of attempts and path segments |
| `/viewer` | 3D model with nodes, segments, destinations and routes |
| `/live` | 2D live map: phones, status chips, visitor and simulated robot routes, rerouting |
| `/operator` | Live map plus path segment controls (needs the operator token) |
| `/health` | Test-point health colors and Explain with AI |

| API | Purpose |
|---|---|
| `POST /api/poses` | Phone pose and tracking status upload (device token) |
| `GET /api/graph` | Nodes, segments, destinations and test points of a public map |
| `GET /api/localization-attempts` | Attempt list and search |
| `POST /api/route` | Shortest route for the human or robot profile |
| `GET /api/health` | Health per test point and device |
| `POST /api/health/summary` | Gemini summary of the health results |
| `PATCH /api/segments` | Operator close, reopen, humans only, allow robots (operator token, 409 on a conflicting change) |

## Run locally

In `app/frontend` (Node.js 22):

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run dev
```

Environment variables (in `.env.local`, and in Vercel for preview and production): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DEVICE_TOKEN`, `OPERATOR_TOKEN`, `GEMINI_API_KEY` and optional `GEMINI_MODEL`. Never commit them.

## Backend schema handoff (Noah Bran)

The M3 migration is
[`202610300001_m3_sessions_commands.sql`](../../app/backend/migrations/202610300001_m3_sessions_commands.sql).
It runs after the M2 foundation and the `pose_samples.sql` and
`202610190002_pose_samples_data_origin.sql` migrations. It was merged in PR #57 and
**applied to the shared Supabase project on Nov 3, 2026**. Do not run it there again.

To check it on a disposable local PostgreSQL database, apply the migrations in order,
then run `app/backend/tests/m3_sessions_commands.sql` (the checks run in a transaction
and roll back).

| Table or change | Contract |
|---|---|
| `navigation_sessions` | One map-fixed session for a `visitor` or `robot_proxy`; a real-phone robot proxy uses `live` mode and `live_sdk` origin. `agent_sessions` is not a separate table. |
| `simulated_agents` | One robot-state row per robot-proxy session. Position is nullable until a real pose arrives and otherwise uses the existing meter-based map frame. Stored route linkage waits for the planned `routes` table. |
| `robot_commands` | Commands are `start`, `pause`, `resume`, `reset`, or `set_destination`. Only the last requires a destination, and it must be on the same map. Status is `pending`, `applied`, or `rejected`; an optional `reason` is allowed only when rejected. `issued_at` records creation and `updated_at` changes on updates. |
| `pose_samples` | Adds nullable `session_id`; `provider_pose` and `world_position` may be null for lost/localizing samples. A `valid` pose requires both. Existing rows remain unchanged. |
| `localization_attempts` | Existing outcome values are `in_progress`, `success`, `timeout`, `tracking_loss`, `network_error`, `map_mismatch`, `cancelled`, and `other_failure`. Existing failures already require `failure_reason`. The reserved `session_id` becomes a same-map foreign key. Horizontal error may be stored; `error_is_valid` requires a live success, a real valid pose from the same attempt, and a verified test-point reference. |
| `test_points` and `m2_get_graph` | Real test points on published public-demo maps become readable and appear in the graph response, so the existing health API can list them. Private-site points remain hidden. |

### Access

The migration enables RLS on the new tables and grants server-side `service_role`
access only; browsers cannot read or write them. Anonymous reads are allowed for live
localization attempts and real test points on published public demo maps, so the
health page can show real data. The M2 synthetic-attempt policy stays, and the M2
search API still filters to synthetic attempts.

Operator segment changes now go through the server: `PATCH /api/segments` (PR #67)
uses the service role, checks a shared operator token and bumps the map's path state
revision (409 on a conflicting change). Still open:

- Accounts and per-site roles (R1, M4) replace the shared operator token.
- The `pose_samples` read policy is still `true` for everyone; it will be limited to
  published public demo maps before the first attempt day (Nov 10).
- `path_segments` is not in the Realtime publication; `/live` and `/operator` poll every 3 s.

### Follow-ups (M4)

- Attempt and run write API (R12.1, R12.2, R11.1): the first item of the data plan.
  Each segment change must be saved with the run ID, time, segment ID and revision
  so a run can be reconstructed after a route change.
- Session creation and `/api/poses` accepting `session_id`.
- Stored robot commands (`set_destination` from `/operator`) and the robot mode in the app (R5.6, R10.1).
- There is no `routes` table yet, so `simulated_agents` has no `route_id`. No command
  execution or simulator is part of this migration.
