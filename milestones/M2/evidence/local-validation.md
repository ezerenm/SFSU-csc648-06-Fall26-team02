# M2 backend validation

Review dates: October 12-14, 2026. Branch: `feature/noah-m2-backend`, based on `origin/dev` at `2d1ea9d`. Supabase configuration, routing integration and later teammate additions were checked after the initial local checks.

These results cover local backend work and a shared Supabase integration check. They are not a production demo sign-off or real VPS evidence. The reviewed M2 migration and synthetic seed were applied to shared Supabase on October 13, 2026. `feature/noah-m2-backend` was pushed and [PR #34](https://github.com/ezerenm/SFSU-csc648-06-Fall26-team02/pull/34) opened against `dev` on October 14. GitHub generated an automatic Vercel preview; the PR was not merged and production was not deployed.

## Environment

- macOS; local Node.js 26.8.1 and npm 11.19.0. The repository targets Node.js 22.x; rerun release checks there before deployment. The local install emitted an engine-version warning.
- Existing locked packages installed with `npm ci --ignore-scripts --no-audit --no-fund`. Vitest was added from Sumit's routing branch to run its tests; the lockfile now includes that dependency.
- Next.js 16.3.5; project TypeScript and ESLint.
- Isolated PostgreSQL 15.19 on localhost, with test equivalents of Supabase's `anon`, `authenticated` and `service_role` roles. The shared Supabase project `kiwinxvtspikqgzbqvqr` runs PostgreSQL 17.6.
- SQL and API unit tests required no `.env.local` or production credentials. The shared integration check used the configured public key; the migration and seed used the dashboard SQL Editor. No `DATABASE_URL` or database password was needed. Credential values were not logged or committed.

## Results

| Check | Result | Scope |
|---|---|---|
| Baseline schema + M2 migration + seed on empty local DB | PASS | Transactional application; all seven tables, policies, indexes and graph function created |
| `app/backend/tests/m2_foundation.sql` | PASS: 57 assertions | Actual PostgreSQL constraints, RLS/privileges, sample records and graph RPC; fixtures roll back |
| `npm test` in `app/frontend` | PASS: 50 API tests and 13 routing tests | Actual API adapter and Sumit's function; mocked Supabase HTTP plus seed-graph routes |
| `npm run typecheck` | PASS | Next.js route type generation and TypeScript |
| `npm run lint` | PASS | Whole app ESLint |
| `git diff --check` | PASS | Tracked diff whitespace; new files also inspected |
| Shared Supabase schema + seed | PASS | SQL Editor applied the reviewed migration and seed as one transaction; the synthetic fixture had 1 site, 1 map, 8 nodes, 10 segments, 3 destinations, 5 points, 10 attempts; graph RPC exists |
| Later HSS 349 / live-position additions | OBSERVED, not authored here | On October 14, the shared database exposed Sumit's HSS 349 placeholder graph (4 nodes, 3 segments, 3 destinations) and `pose_samples` (0 rows). SQL files are on `origin/feature/sumit-live-position`; no teammate branch was merged into Noah's branch. |
| Public-key Supabase reads | PASS | Graph RPC returned the synthetic site and expected graph counts; attempt relationship query returned 4 successes |
| `npm run build -- --webpack` with configured `.env.local` | PASS after routing integration | Compilation, TypeScript, prerendering and route generation completed |
| Default `npm run build` | ENVIRONMENT LIMIT | Before configuration, Google Fonts fetch failed; a later Turbopack worker could not bind a local port. The default command was not rerun after configuration. |
| Local Next.js HTTP smoke checks | PASS: 7 cases | Before configuration: endpoint registration, invalid inputs, missing configuration, no-store responses and unsupported method |
| Local Next.js HTTP against shared Supabase | PASS: 8 cases | Graph 200/8 nodes; search pagination, combined filters, empty and out-of-range results; human 8 m, robot 16 m and unreachable route responses |
| Integrated route on the seeded graph | PASS: 4 cases | Human 8 m, robot 16 m, unreachable East room, zero-distance start through the API handler and Sumit's function |

The earlier `/about` build failure was resolved by the local Supabase configuration; no code change to that page was needed. The successful build used Webpack as a verification option only; the package's default build command remains unchanged. The shared database check used the synthetic fixture; it does not validate real scan alignment, iPhone localization or deployed Vercel behavior.

## Database assertions

The SQL suite verifies:

- Expected counts: 8 nodes, 10 segments, 3 destinations, 5 test points and 10 attempts; 4 successes and exact point/outcome matches.
- Same-site, published active-map references, same-map/revision segment endpoints and destinations, and same-map test points for attempts.
- Rejection of self-edges, zero/NaN/infinite distances, invalid geometry, stale geometry after moving nodes, invalid positions/frames and unsupported enum values.
- Required failure reasons, success and timeout timing rules, synthetic-origin rules and reserved-null pose references.
- Referenced nodes cannot be deleted; reopening preserves robot restrictions.
- All seven tables deny INSERT/UPDATE/DELETE/TRUNCATE privileges to both public application roles.
- Anonymous and authenticated reads hide private/draft maps, future-revision nodes, real test points and live attempts.
- The invoker-rights graph RPC respects RLS and returns null for absent/private/draft maps.

The example [graph-response.json](../examples/graph-response.json) was exported from this seeded local database. It is a synthetic fixture, not a response captured from the shared Supabase service.

## API assertions

The API test runner compiles project TypeScript into a temporary directory and uses Node's built-in test runner. Vitest runs Sumit's routing tests. Together they check malformed/missing/repeated parameters, UUID validation, supported outcomes, combined filters, pagination, clean empty results, guarded configuration, sanitized errors and no-store headers. The Supabase adapter tests exercise the actual SDK request construction with mocked fetch responses, including the graph RPC, filter encoding and out-of-range handling.

Routing handler tests check that the API passes one graph snapshot, resolves the destination node, includes revisions and manual-start labeling, preserves unreachable/zero-distance results, and rejects wrong directions, closed edges, robot restrictions, disconnected steps and incorrect distances. Four cases use the actual integrated Dijkstra function. Sumit's 13 unit tests include shortest-path cross-checks. Human, robot and unreachable requests also passed through local HTTP against the shared Supabase graph. Deployed viewer routing remains unverified.

Local HTTP checks used Next.js in Webpack development mode on `127.0.0.1:3102` **before `.env.local` was configured**:

| Request | Observed result |
|---|---|
| Graph without map ID | 400 `INVALID_REQUEST` |
| Graph with valid sample map UUID, no DB config | 503 `CONFIGURATION_ERROR` |
| Attempts with invalid outcome | 400 `INVALID_REQUEST` |
| Attempts with valid sample map UUID, no DB config | 503 `CONFIGURATION_ERROR` |
| Route with invalid profile | 400 `INVALID_REQUEST` |
| Route with valid body, no DB config | 503 `CONFIGURATION_ERROR` |
| POST to read-only graph endpoint | 405 |

After applying the shared schema and seed, local Next.js on `127.0.0.1:3102` returned HTTP 200 for `GET /api/graph` (8 nodes), filtered `GET /api/localization-attempts` (4 total successes, 2 in the requested page), and three `POST /api/route` cases: human N1 to Room 103 at 8 m, robot N1 to Room 103 at 16 m, and unreachable East room with null distance. Additional search checks passed for combined TP2/timeout/label filters (1 match), no matches (empty list and zero total), and an out-of-range page (empty list with 4 total). The server was stopped after verification.

## Reproduction

From the repository root, against a new disposable local database with the three Supabase-equivalent roles:

```sh
psql -v ON_ERROR_STOP=1 -d <local_database> -f app/backend/schema.sql
psql -v ON_ERROR_STOP=1 -d <local_database> -f app/backend/migrations/202610110001_m2_foundation.sql
psql -v ON_ERROR_STOP=1 -d <local_database> -f milestones/M2/seed.sql
psql -v ON_ERROR_STOP=1 -d <local_database> -f app/backend/tests/m2_foundation.sql
```

From `app/frontend`:

```sh
npm ci
npm test
npm run typecheck
npm run lint
npm run build
```

Use Node.js 22 and the reviewed Supabase configuration for the deployment build. The shared database scripts have already been applied; do not rerun them on the project. Deployment remains pending approval.

## Pending acceptance evidence

| M2 check | Remaining evidence / owner |
|---|---|
| Shared Supabase schema and graph/search API | Applied and verified against PostgreSQL 17.6 through local Next.js; deployed app verification remains; Noah and Ezeren |
| Route from database graph | Human, robot and unreachable routes verified through local HTTP; viewer integration remains; Sumit and Ezeren |
| Real model and graph alignment | Approved GLB/Storage path, scale, axes/origin, model-to-graph checks; Ezeren and Daksh |
| Real iPhone localization | VPS pose, orientation, timestamp, screenshot/video and three-point transform check; Sumit and Daksh |
| Vercel viewer/search demo | Connected UI, empty states, narrow-screen and keyboard checks; Ezeren and Calvin |
| Live row edit/refresh/revert | Explicitly approved Supabase edit and screenshot evidence; Noah and Tyler |
| Production checklist | Pass/fail and screenshot for every M2 item; Tyler runs, Sumit signs off |
