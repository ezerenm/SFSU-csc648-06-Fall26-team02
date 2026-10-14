# Milestone 2 backend handoff

Owner: Noah Bran (Backend Lead). Scope authority: **SpatialOS M2 Team Plan v2**, updated October 10, 2026. M1 supplies broader system context; its Android platform and older implementation schedule are superseded by M2's iPhone plan.

## Deliverables

| Deliverable | Location | Status |
|---|---|---|
| Seven-table schema, constraints, read policies, graph query | [Migration](../../app/backend/migrations/202610110001_m2_foundation.sql) | Applied to shared Supabase and checked in local PostgreSQL |
| Tyler's labeled sample data | [Seed SQL](seed.sql), [seed guide](SEED_GUIDE.md) | Working synthetic fixture |
| Shared types and integration contracts | [TypeScript](../../app/frontend/lib/spatial/contracts.ts), [contracts](CONTRACTS.md) | Ready for teammate review |
| Graph retrieval API | `GET /api/graph` | Verified through local Next.js against shared Supabase; deployment pending |
| Localization-attempt list/search API | `GET /api/localization-attempts` | Verified through local Next.js against shared Supabase; deployment pending |
| Route API | `POST /api/route` | Sumit's Dijkstra function verified through local Next.js against shared Supabase; deployment pending |
| M2 Section 4 | [Architecture, Database and APIs](SpatialOS_M2_Section4_Architecture_DB_APIs.md) | Draft for Daksh and Ezeren |
| Verification and remaining demo work | [Local evidence](evidence/local-validation.md) | Local results only; no production sign-off |

## Local setup

The existing `app/backend/schema.sql` remains the M0 baseline. New SQL changes are ordered files in `app/backend/migrations/`; do not repeatedly run the baseline over existing tables.

For a **new disposable local PostgreSQL database**, create roles `anon`, `authenticated` and `service_role` if they do not exist. Supabase creates these roles itself. Apply in this order, with `psql -v ON_ERROR_STOP=1 -d <local_database> -f <file>`:

1. `app/backend/schema.sql`
2. `app/backend/migrations/202610110001_m2_foundation.sql`
3. `milestones/M2/seed.sql`
4. `app/backend/tests/m2_foundation.sql` (checks run inside a transaction and roll back)

The migration and seed are apply-once scripts. A second execution fails instead of replacing or silently changing existing records. Migration tracking is manual for this milestone; no existing migration framework was present. The reviewed scripts were applied together in one transaction to the shared Supabase project `kiwinxvtspikqgzbqvqr` on October 13, 2026. Do not rerun them there.

In `app/frontend`, use the existing Node.js 22 setup:

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run dev
```

`npm test` runs the API tests with Node's test runner and Sumit's routing tests with Vitest. Tests use the labeled graph fixture and mocked Supabase HTTP responses. They do not load `.env.local` or contact Supabase.

For actual API database requests, the existing `.env.local` variables must point to the Supabase project where the reviewed migration and seed have been applied:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=<project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key or legacy anon JWT>
```

Never put a secret/service-role key in either variable. These APIs deliberately use the public database role and enforce the public read policies. Plain PostgreSQL is sufficient for SQL tests, but does not provide Supabase's HTTP API.

The migration and seed were applied through the project's Supabase SQL Editor; a `DATABASE_URL` was not needed. The Next.js APIs use only the public key above. If an administrative connection string is needed later, keep it in an ignored local file or private credential store, never in frontend source, a public environment variable, commits or screenshots.

## Immediate teammate use

- **Tyler:** use [seed.sql](seed.sql) and its [expected results](SEED_GUIDE.md). Keep all invented coordinates and attempts labeled synthetic. Replace real-site data only after the scan and alignment are agreed.
- **Sumit:** review the [routing adapter](../../app/frontend/lib/spatial/server/routing.ts) for the function copied from `origin/feature/r5-routing` at `ab1db5c`; the [seed graph](examples/graph-response.json) passes human, robot, unreachable and zero-distance routes locally.
- **Ezeren:** use `nodes`, `segments`, `destinations`, and `steps` from the [wire types](../../app/frontend/lib/spatial/contracts.ts). The field shapes preserve the viewer branch's conventions; replace temporary `N1`/`D1` identifiers with the returned UUIDs. The APIs now return the synthetic fixture through the local app; the deployed viewer still needs integration.
- **Calvin:** populate the point filter from `graph.test_points`; use the attempt endpoint's `items`, `total`, `limit` and `offset`. Empty `items` should display “No results.”
- **Daksh:** review Section 4 and the dependency table below when assembling the milestone document. Section 4 starts a new page in the assembled report.

## Dependencies and decisions requiring team review

| Item | Current decision / dependency | Owner |
|---|---|---|
| Spatial conventions | Adopt Sumit's right-handed, Y-up, meter-based world frame. Exact origin and axis directions on the real model remain unverified. | Sumit, Ezeren, Daksh |
| Segment length | `distance_m` equals the geometry's 3D polyline length within 0.01 m; geometry endpoints equal node positions. Confirm this rule before entering real paths. | Noah, Sumit, Ezeren |
| Data-definition additions | `sites.is_public_demo` controls public graph exposure; `destinations.graph_revision` enforces node revision consistency. | Noah, Sumit |
| Deferred references | `visual_asset_id`, `session_id`, `valid_pose_sample_id`, and measured error fields stay null/false until their referenced records and validation rules are implemented. Sumit's separate `pose_samples` table does not populate these reserved attempt fields. | Noah, Sumit |
| Access | Public reads require an opted-in site and published map. Only synthetic points/attempts are public; all app writes are denied. Role/site membership workflows remain planned. | Noah; approved M2 approach |
| Actual scan/model | Sumit's HSS 349 site and map now exist in shared Supabase with explicitly placeholder graph coordinates. An approved GLB/Storage path, provider map identity and verified transform are still not supplied here. | Daksh, Ezeren, Sumit |
| Routing | Sumit's function and tests from `origin/feature/r5-routing` at `ab1db5c` are copied into this branch and connected through a thin adapter. Review behavior against the real map and coordinate conventions. No teammate branch was merged or cherry-picked. | Sumit, Noah |
| Live position | `origin/feature/sumit-live-position` adds `pose_samples`, an HSS 349 placeholder graph, `POST /api/poses`, and a live page. Its SQL is already applied to shared Supabase; the files remain on Sumit's branch and are not part of this handoff. Read-only checks found the HSS graph and no pose rows on October 14. Preserve these records and coordinate branch integration with Sumit. | Sumit, Noah |
| Mobile gate | A real iPhone VPS pose, orientation, timestamp, and screenshot/video are required October 13. Synthetic records or manual routes cannot satisfy it. | Sumit, Daksh |
| Deployment and UI | Supabase SQL is applied. Wire viewer/search UI, deploy and run the production checklist only after approval. | Noah, Ezeren, Calvin, Tyler |

## Scope boundaries

M2 implements manual-start route integration, published graph reads and synthetic attempt search. It does not implement robot simulation, live closures, automatic rerouting, a health dashboard, Gemini summaries, live-start snapping, or phone telemetry ingestion. Human/robot access fields and profile contracts support routing without implementing a simulated robot.

The inspected source branches were `origin/dev` at `2d1ea9d`, `origin/chore/backend-schema` at `30f961c`, `origin/docs/m2-data-definitions` at `2ec1d0c`, and `origin/feature/m2-viewer` at `47f67cd`. The backend schema branch was already included in `dev`. No teammate branch was merged or cherry-picked. Sumit's Section 1 and Ezeren's viewer remain owned on their respective branches.
