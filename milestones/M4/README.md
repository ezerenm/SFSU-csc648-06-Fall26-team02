# M4 accounts and site roles

## Implementation status

The account and role work is on `feature/noah-m4-auth-roles`. It has not been
merged, deployed, or applied to the shared Supabase project.

The additive migration
[`202611080001_m4_accounts_roles.sql`](../../app/backend/migrations/202611080001_m4_accounts_roles.sql)
creates `user_profiles` and `site_memberships`. Supabase Auth keeps passwords
and issues the user session. The profile uses the Auth user ID; one membership
per user and site holds exactly one of `visitor`, `developer`, `operator`, or
`administrator`. An inactive membership grants no permissions.
New signups automatically receive an active visitor membership for the HSS 349
demo site. Only an administrator can grant or change operator access.

RLS lets users read their own profile and membership. Administrators can grant,
change, or deactivate memberships for their site. Only active operators and
administrators can update a path segment's availability or robot access.
Anonymous users, visitors, and developers cannot. A database trigger increments
the map's path-state revision in the same transaction as a segment state change,
and a no-op update does not increment it.

The `/account` page provides Supabase Auth sign-up, sign-in, sign-out, and a
view of the signed-in user's memberships. It shows the account ID so a site
administrator can assign, change, or deactivate that person's role using the
role manager on the same page. The `/operator` page now sends the
user's access token to `PATCH /api/segments`; the server verifies the token and
uses the publishable key under that user's RLS permissions. The service-role key
is no longer used by this endpoint.

## Decisions needed before rollout

- Which existing Auth user should be bootstrapped as the first HSS 349
  administrator. This requires a reviewed, one-time insert into
  `site_memberships` after the migration. No account password belongs in SQL.

The current account page displays the site's ID in the personal membership
list. Demo account provisioning and live Auth settings are still needed for
the handoff.

The old shared operator token was requested only through Tuesday's runs. This
branch replaces it with per-user access tokens and does not accept the old
token. Deploy the account route only after the migration and first
administrator membership are ready.

## Live attempt ingestion (R12)

`POST /api/localization-attempts` accepts the phone's completed try with the
same `x-device-token` used by `/api/poses`. The body requires `attempt_id`,
`map_version_id`, `test_point_id`, `device_id`, `sdk_version`, `mode: "live"`,
`data_origin: "live_sdk"`, `condition_label`, `camera_direction`, `started_at`,
`ended_at`, `outcome`, `failure_reason`, and `latency_ms`. It supports the schema's
failure outcomes: `timeout`, `tracking_loss`, `network_error`, `map_mismatch`,
`cancelled`, and `other_failure`. A failure needs a nonempty reason. The phone's
empty success reason becomes SQL `NULL`; its `-1` failure latency becomes SQL
`NULL`. Invalid payloads return 422; an invalid device token returns 401.

The server calls the service-role-only `m4_record_live_attempt` function from
[`202611100001_m4_attempt_ingestion.sql`](../../app/backend/migrations/202611100001_m4_attempt_ingestion.sql).
The function inserts the attempt, or returns 200 for a retry with the same ID
and data. A reused ID with different data returns 409. New rows return 201.
The insert and pose association happen in one database transaction.

For a success, the function selects the first real, valid pose for the same map
and device whose `captured_at` falls between `started_at` and `ended_at`. It
links that pose to the attempt. If the test point has a verified reference, it
calculates horizontal X/Z distance in meters, stores the pose ID and error, and
sets `error_is_valid`. An unverified point or missing qualifying pose leaves
the error null and invalid. A retry can fill the error if a pose was uploaded
after the first POST. The phone sender confirmed that the pose upload completes
before the attempt POST. If that ordering changes, an attempt that is never
retried will not get a later error automatically.

The endpoint does not create a `navigation_sessions` run. `session_id` remains
null for these records because the supplied phone payload has no run ID. Run
creation and linking remain a separate integration task. The v3 test-point
migration is merged into `dev`; confirm it was applied to the target Supabase
database before real phone tries are sent.

## Verification and rollout

The migration was applied only to a disposable local PostgreSQL database. Run
[`m4_accounts_roles.sql`](../../app/backend/tests/m4_accounts_roles.sql)
after the M2 seed and M3 migration. It tests profile creation, anonymous and
visitor denial, cross-site denial, operator and administrator access, role
promotion rules, revision changes, and preservation of robot restrictions.
[`m4_attempt_ingestion.sql`](../../app/backend/tests/m4_attempt_ingestion.sql)
tests first-pose selection, measured error, retry idempotency, ID collisions,
and failure storage using a rolled-back real-point fixture. Both SQL tests
passed locally on PostgreSQL 15; shared Supabase integration remains untested.

The application routes and both migrations must reach the same environment
together. Deploying the new routes before the migrations would make writes
fail because their tables, policies, or function would be missing. Applying the
account migration while the old service-role segment route is deployed would
make that route increment path-state revisions twice. Coordinate the rollout
with the team; do not run these migrations on shared Supabase until they are
reviewed and the deployment order is agreed.
