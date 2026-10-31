# M3 backend schema handoff

The first M3 backend migration is
[`202610300001_m3_sessions_commands.sql`](../../app/backend/migrations/202610300001_m3_sessions_commands.sql).
It is intended to run after the M2 foundation and Sumit's `pose_samples.sql` and
`202610190002_pose_samples_data_origin.sql` migrations. Merging the code does not
apply the migration to the shared Supabase database; deployment is a separate step.

| Table or change | Contract |
|---|---|
| `navigation_sessions` | One map-fixed session for a `visitor` or `robot_proxy`; a real-phone robot proxy uses `live` mode and `live_sdk` origin. `agent_sessions` is not a separate table. |
| `simulated_agents` | One robot-state row per robot-proxy session. Position is nullable until a real pose arrives and otherwise uses the existing meter-based map frame. Stored route linkage waits for the planned `routes` table. |
| `robot_commands` | Commands are `start`, `pause`, `resume`, `reset`, or `set_destination`. Only the last requires a destination, and it must be on the same map. Status is `pending`, `applied`, or `rejected`; an optional `reason` is allowed only when rejected. `issued_at` records creation and `updated_at` changes on updates. |
| `pose_samples` | Adds nullable `session_id`; `provider_pose` and `world_position` may be null for lost/localizing samples. A `valid` pose requires both. Existing rows remain unchanged. |
| `localization_attempts` | Existing outcome values are `in_progress`, `success`, `timeout`, `tracking_loss`, `network_error`, `map_mismatch`, `cancelled`, and `other_failure`. Existing failures already require `failure_reason`. The reserved `session_id` becomes a same-map foreign key. Horizontal error may be stored; `error_is_valid` requires a live success, a real valid pose from the same attempt, and a verified test-point reference. |

The migration enables RLS on the new tables and grants server-side `service_role`
access. It intentionally grants no browser access to those tables yet. It adds
anonymous read access to live localization attempts only on published public-demo
maps for the planned health view. The M2 synthetic-attempt policy remains in place;
the current M2 search API still filters to synthetic attempts. Account membership,
operator policies, segment state APIs, and Realtime publication need separate
reviewed work. The current M2 `pose_samples` select policy is unchanged.

The `routes` table is not present yet, so `simulated_agents` does not include a
`route_id` column. No command execution, attempt-ingestion API, or simulator is
implemented by this schema migration. Session creation, `/api/poses` accepting
`session_id`, and a dedicated health read API remain follow-ups.
