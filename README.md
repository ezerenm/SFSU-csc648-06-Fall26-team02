# SFSU-csc648-06-Fall26-team02

CSC 648/848 Software Engineering, Section 06, Team 02 (Fall 2026)

**SpatialOS: Shared Spatial Operations and Localization Reliability.** Visitors and a simulated robot share one scanned SFSU indoor area (HSS 349). iPhones localize with Niantic VPS and stream their position and tracking status to a live web map; the system routes humans and the robot on their own permitted paths, and an operator closes or restricts path segments so routes change live. After the M3 review the main focus is **localization data and accuracy**: collection runs, per-test-point health, failure analysis for the operator, and a Gemini summary in which every number is checked against the data.

- **Live site:** https://sfsu-csc648-06-fall26-team02.vercel.app
- **About page:** https://sfsu-csc648-06-fall26-team02.vercel.app/about
- **M3 task board:** https://github.com/users/tduong64/projects/1
- **Current milestone:** [M3](milestones/M3/README.md) (Appendix I submitted Nov 4, 2026)

## Team

| Name | Role | GitHub |
|---|---|---|
| Daksh Kumar | Team Lead | [@Dakshkumar24](https://github.com/Dakshkumar24) |
| Calvin Mei | Front-End Lead | [@Kaolinium](https://github.com/Kaolinium) |
| Noah Bran | Back-End Lead | [@NoahBran8](https://github.com/NoahBran8) |
| Sumit Kumar | AI Master | [@Sumitkumar06](https://github.com/Sumitkumar06) |
| Tyler Duong | Scrum Master | [@tduong64](https://github.com/tduong64) |
| Ezeren Masangcay | GitHub Master | [@ezerenm](https://github.com/ezerenm) |



## Tech Stack

| Layer | Technology |
|---|---|
| Hosting | Vercel (Hobby tier) |
| Framework | Next.js 16 (App Router), React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Backend | Next.js API routes on Node.js 22 (Vercel serverless) |
| Database | Supabase (PostgreSQL 17) |
| Auth | Supabase Auth (accounts and roles planned, R1) |
| AI | Google Gemini API (REST, gemini-flash-lite) |
| 3D viewer | Three.js |
| Phone app | Unity 6000.3.14f1 + Niantic Spatial SDK 4.1.0 (iPhone) |
| Localization | Niantic VPS, Scaniverse scans |
| Tests | Node test runner and Vitest |
| IDE | VS Code |

## Repository Layout

```
SFSU-csc648-06-Fall26-team02/
├── milestones/
│   ├── M0/       M0 submission report
│   ├── M1/       Milestone 1 document
│   ├── M2/       Milestone 2 document, backend handoff, contracts, seed
│   ├── M3/       Appendix I, UML sources, M3 backend handoff
│   ├── M4/
│   └── M5/
├── app/
│   ├── frontend/ Next.js application (pages, API routes, components, lib/spatial, lib/routing, tests)
│   ├── backend/  Schema, ordered migrations and SQL tests
│   └── phone/    Unity iPhone client (see app/phone/README.md)
└── .github/workflows/  Supabase keep-alive job
```

## Local Setup

Requires Node.js 20.9 or higher (Next.js 16 minimum). Node.js 22 recommended to match production.

```bash
git clone https://github.com/ezerenm/SFSU-csc648-06-Fall26-team02.git
cd SFSU-csc648-06-Fall26-team02/app/frontend
npm install
```

Create `app/frontend/.env.local` (ask the team for the values, never commit this file):

```
NEXT_PUBLIC_SUPABASE_URL=<project url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key>
```

That is enough for the read-only pages. Server features need more variables, which are set in Vercel and only added locally when you work on them: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (operator changes), `DEVICE_TOKEN` (phone pose upload), `OPERATOR_TOKEN` (/operator), `GEMINI_API_KEY` and optional `GEMINI_MODEL` (AI summary). Never commit any of them; the service role key never goes in a `NEXT_PUBLIC_` variable.

Run the dev server:

```bash
npm run dev
```

Open http://localhost:3000. Before a PR, run the checks:

```bash
npm run typecheck
npm run lint
npm test
```

The iPhone app has its own setup guide in [app/phone/README.md](app/phone/README.md).

## Routes

| Page | Description |
|---|---|
| `/` | Home: list and search localization attempts, destinations and path segments |
| `/viewer` | 3D model of the scanned area with nodes, segments, destinations and routes |
| `/live` | 2D live map: phones with status chips, visitor and simulated robot routes, rerouting |
| `/operator` | Live map plus Close, Reopen, Humans only and Allow robots for each path segment (operator token) |
| `/health` | Localization health per test point and Explain with AI |
| `/about`, `/about/<name>` | Team pages from the `team_members` table |

| API | Description |
|---|---|
| `POST /api/poses` | Phone pose and tracking status upload (device token) |
| `GET /api/graph?map_version_id=<uuid>` | Nodes, segments, destinations and test points of a public map |
| `GET /api/localization-attempts?map_version_id=<uuid>` | Attempt list and search with point and outcome filters |
| `POST /api/route` | Shortest route (Dijkstra) for the human or robot profile |
| `GET /api/health?map_version_id=<uuid>` | Health per test point and device |
| `POST /api/health/summary` | Gemini summary of the health results, numbers checked |
| `PATCH /api/segments` | Operator segment change (operator token, 409 on a conflicting change) |
| `GET /api/team` | Team data from Supabase |

## Git Workflow

- `main`: production, auto-deploys to Vercel. No direct pushes.
- `dev`: integration branch. All PRs target `dev`.
- `feature/<name>`: new work (e.g. `feature/about-sumit`)
- `chore/<name>`: cleanup, docs, config

**Steps**

1. `git checkout dev && git pull`
2. `git checkout -b feature/<name>`
3. Commit and push, then open a PR **into `dev`**. Put the requirement IDs in the title and a "How to review" section in the description.
4. Get two reviews, then merge (regular merge commit) and delete the branch. Keep `dev`.
5. `dev` is merged into `main` for releases

Never commit `.env.local`, keys, or personal info (emails, student IDs). The repo is public.

## Database

Supabase PostgreSQL with Row Level Security on every table. Schema changes are ordered files in `app/backend/migrations/` with SQL tests in `app/backend/tests/`; they are applied to the shared project by hand, once.

- M0: `users`, `team_members`
- Map and route graph (M2): `sites`, `map_versions`, `graph_nodes`, `path_segments`, `destinations`, `test_points`, `localization_attempts`
- Live position: `pose_samples`
- M3: `navigation_sessions`, `simulated_agents`, `robot_commands` (server-only for now)

## Milestones

| Milestone | Contents |
|---|---|
| [M0](milestones/M0) | Team setup report |
| [M1](milestones/M1) | Requirements, personas, competitive analysis |
| [M2](milestones/M2/README.md) | M2 document, vertical prototype, backend handoff, contracts, seed data |
| [M3](milestones/M3/README.md) | Appendix I (feedback and action plan, frozen P1 list, UML, risks), UML sources, M3 backend handoff |
| M4, M5 | Upcoming |

## Deployment

Pushing to `main` triggers a Vercel production deploy. Every PR gets a Vercel preview link for review. Environment variables are set in Vercel under Settings, Environment Variables; a change only takes effect after a new deploy.

The Supabase free tier pauses a project after about 7 days idle. The `keep-supabase-alive` GitHub Action pings it daily from `main`, so it stays awake.

## License

Licensed under the [Apache License 2.0](LICENSE).
