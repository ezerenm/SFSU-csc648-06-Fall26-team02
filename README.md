# SFSU-csc648-06-Fall26-team02

CSC 648/848 Software Engineering, Section 06, Team 02 (Fall 2026)

- **Live site:** https://sfsu-csc648-06-fall26-team02.vercel.app
- **About page:** https://sfsu-csc648-06-fall26-team02.vercel.app/about

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
| Auth | Supabase Auth |
| AI | Google Gemini API |
| IDE | VS Code |

## Repository Layout

```
SFSU-csc648-06-Fall26-team02/
├── milestones/
│   ├── M0/       M0 submission report
│   ├── M1/       Milestone 1 document
│   ├── M2/
│   ├── M3/
│   ├── M4/
│   └── M5/
└── app/
    ├── frontend/ Next.js application (pages, API routes, components)
    └── backend/  Database schema and server-side utilities
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

Only the **publishable** key goes here. The secret / `service_role` key stays in the Supabase dashboard.

Run the dev server:

```bash
npm run dev
```

Open http://localhost:3000.

## Routes

| Route | Description |
|---|---|
| `/about` | Team page, rendered from the `team_members` table |
| `/about/<name>` | Individual member page |
| `/api/team` | JSON endpoint returning team data from Supabase |

## Git Workflow

- `main`: production, auto-deploys to Vercel. No direct pushes.
- `dev`: integration branch. All PRs target `dev`.
- `feature/<name>`: new work (e.g. `feature/about-sumit`)
- `chore/<name>`: cleanup, docs, config

**Steps**

1. `git checkout dev && git pull`
2. `git checkout -b feature/<name>`
3. Commit and push, then open a PR **into `dev`**
4. Get one review, then merge (regular merge commit) and delete the branch. Keep `dev`.
5. `dev` is merged into `main` for releases

Never commit `.env.local`, keys, or personal info (emails, student IDs). The repo is public.

## Database

Tables in the `public` schema:

- `users`: application user accounts
- `team_members`: team roster shown on the ABOUT page

Row Level Security is enabled on both. `team_members` has a public read policy. `users` is not publicly readable.

## Deployment

Pushing to `main` triggers a Vercel production deploy. Every PR gets a Vercel preview link for review. Environment variables are set in Vercel under Settings → Environment Variables.

Note: the Supabase free tier pauses a project after about 7 days idle. Open the live site before milestone reviews.

## License

Licensed under the [Apache License 2.0](LICENSE).
