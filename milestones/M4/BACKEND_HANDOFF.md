# M4 Backend Handoff: Accounts, Attempt Ingestion and Runs

**SpatialOS** · SW Engineering CSC 648/848 · Section 06, Team 02 · Owner: Noah Bran (Back-end Lead)

| Item | Link |
|---|---|
| **Milestone 4 summary** | [README.md](README.md) |
| **Migrations** | [`app/backend/migrations/`](../../app/backend/migrations) |
| **SQL tests** | [`app/backend/tests/`](../../app/backend/tests) |
| **M2 contracts** | [`milestones/M2/CONTRACTS.md`](../M2/CONTRACTS.md) |

> Written Nov 8 to 16 for M4. Statuses were updated on Nov 24, 2026 after release #117; the technical contracts are kept as written.

## Rollout status

| Item | Status |
|---|---|
| [`202611080001_m4_accounts_roles.sql`](../../app/backend/migrations/202611080001_m4_accounts_roles.sql) | **Applied to shared Supabase on Nov 22, 2026.** Do not run it again. |
| [`202611100001_m4_attempt_ingestion.sql`](../../app/backend/migrations/202611100001_m4_attempt_ingestion.sql) | **Applied to shared Supabase on Nov 22, 2026.** Do not run it again. |
| [`202611160001_m4_runs.sql`](../../app/backend/migrations/202611160001_m4_runs.sql) | **Applied to shared Supabase on Nov 22, 2026.** Do not run it again. |
| Application routes | **Live on production** in release #117, deployed together with the migrations |
| First HSS 349 administrator | Bootstrapped with a reviewed one-time insert into `site_memberships`; a second administrator was then added through `/account` |
| Phone sending live attempts | Not yet. The endpoint is ready; the phone recorder is planned for M5 |
| `/live` Start run button | Still local state only; wiring it to `/api/runs` is planned for M5 |

## Accounts and site roles (R1)

The migration creates `user_profiles` and `site_memberships`. Supabase Auth keeps passwords and issues the user session. The profile uses the Auth user ID; one membership per user and site holds exactly one of `visitor`, `developer`, `operator` or `administrator`. An inactive membership grants no permissions. New sign-ups automatically receive an active visitor membership for the HSS 349 demo site. Only an administrator can grant or change operator access.

Row level security lets users read their own profile and membership. Administrators can grant, change or deactivate memberships for their site. Only active operators and administrators can update a path segment's availability or robot access; anonymous users, visitors and developers cannot. A database trigger increments the map's path state revision in the same transaction as a segment state change, and a no-op update does not increment it.

The `/account` page provides sign-up, sign-in, sign-out and a view of the signed-in user's memberships. It shows the account ID so a site administrator can assign, change or deactivate that person's role with the role manager on the same page. The `/operator` page sends the user's access token to `PATCH /api/segments`; the server verifies the token and uses the publishable key under that user's row level security. The service role key is not used by this endpoint.

## Live attempt ingestion (R12)

`POST /api/localization-attempts` accepts the phone's completed try with the same `x-device-token` used by `/api/poses`. The body requires `attempt_id`, `map_version_id`, `test_point_id`, `device_id`, `sdk_version`, `mode: "live"`, `data_origin: "live_sdk"`, `condition_label`, `camera_direction`, `started_at`, `ended_at`, `outcome`, `failure_reason` and `latency_ms`. It supports the schema's failure outcomes: `timeout`, `tracking_loss`, `network_error`, `map_mismatch`, `cancelled` and `other_failure`. A failure needs a nonempty reason. The phone's empty success reason becomes SQL `NULL`; its `-1` failure latency becomes SQL `NULL`.

| Response | When |
|---|---|
| 201 | New attempt saved |
| 200 | Retry with the same ID and the same data |
| 401 | Invalid device token |
| 409 | Reused ID with different data |
| 422 | Invalid payload |

The server calls the service-role-only `m4_record_live_attempt` function, which inserts the attempt and links its pose in one database transaction.

For a success, the function selects the first real, valid pose for the same map and device whose `captured_at` falls between the reported success time (`started_at + latency_ms`) and `ended_at`, and links that pose to the attempt. If the test point has a verified reference, it calculates the horizontal X/Z distance in meters, stores the pose ID and error, and sets `error_is_valid`. An unverified point or a missing qualifying pose leaves the error null and invalid. A retry can fill the error if a pose was uploaded after the first POST. The phone uploads the pose before the attempt; if that order changes, an attempt that is never retried will not get a later error automatically.

The existing data definition limits a successful localization to 30 seconds. The phone should set `ended_at` and `latency_ms` from the localization result, not from the later network upload; an upload delay does not extend the attempt.

## Collection runs (R11.1)

The run migration allows a null `device_model` when `/live` cannot identify the phone model, and prevents two active live robot runs for the same map and device. Row level security lets a signed-in developer, operator or administrator with an active membership for the map's site start and stop a run. Visitors and anonymous users cannot.

The API accepts `Authorization: Bearer <Supabase access token>`:

| Request | Result |
|---|---|
| `POST /api/runs` with `{ "map_version_id": "uuid", "device_id": "phone ID" }` | Creates a live `robot_proxy` session and returns `{ "run_id": "uuid" }` (201). A second active run for that map and device returns 409. |
| `PATCH /api/runs` with `{ "run_id": "uuid", "action": "stop" }` | Sets `status: "ended"` and `ended_at`. Repeating Stop returns the ended run (200). |
| `GET /api/runs/counts?run_id=<uuid>` | Returns `{ "samples": n, "attempts": n, "failures": n }` for a run on a published public demo map, including records uploaded after Stop whose capture time falls inside the run. |

The database attaches real poses by `captured_at` and live attempts by `started_at`, using the map, device and run time window. Uploads outside a run keep a null `session_id`. The phone payload and `x-device-token` do not change.

Path segment changes stay independent of runs. A map can change with no active run, so a future path change log needs a nullable run association. That log is not part of this API.

## Verification

| SQL test | Checks | Result |
|---|---|---|
| [`m4_accounts_roles.sql`](../../app/backend/tests/m4_accounts_roles.sql) | Profile creation, anonymous and visitor denial, cross-site denial, operator and administrator access, role promotion rules, revision changes, robot restrictions kept | Passed on disposable PostgreSQL 15 |
| [`m4_attempt_ingestion.sql`](../../app/backend/tests/m4_attempt_ingestion.sql) | Success-time pose selection, measured error, retry idempotency, late pose linked on retry, ID collisions, failure storage | Passed on disposable PostgreSQL 15, and again on PostgreSQL 16 with all migrations (IT-28) |
| [`m4_runs.sql`](../../app/backend/tests/m4_runs.sql) | Visitor denial, developer Start and Stop, one active run per device, delayed uploads attaching to an ended run | Passed on disposable PostgreSQL 15, and again on PostgreSQL 16 with all migrations (IT-28) |

Run each test after the M2 seed and the M3 migration on a disposable database; the checks run in a transaction and roll back. After release #117 the account and segment flows were also checked end to end on production (integration cases IT-23 to IT-27).
