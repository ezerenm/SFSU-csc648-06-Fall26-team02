# Milestone 0: Team Setup and Technology Stack

**SW Engineering CSC 648/848** · Section 06, Team 02 · Submitted September 15, 2026

| | |
|---|---|
| **Submitted report** | [CSC 648-848 M0 section 6 Team 2.pdf](CSC%20648-848%20M0%20section%206%20Team%202.pdf) ([.docx](CSC%20648-848%20M0%20section%206%20Team%202.docx)) |
| **Team About page** | <https://sfsu-csc648-06-fall26-team02.vercel.app/about> |
| **Next milestone** | [Milestone 1](../M1) |

## What M0 set up

- **Repository and workflow:** this GitHub repo with `main` (production), `dev` (integration) and feature branches merged through pull requests.
- **Hosting:** Vercel (Hobby tier), auto-deployed from `main`. No VM; the app runs as a managed serverless platform.
- **Database:** Supabase PostgreSQL 17 (project `csc648-team02`, West US) with the `users` and `team_members` tables and row level security. The TA and the instructor were invited as administrators.
- **First deployed pages:** the team About page (`/about`, `/about/<name>`) and the `/api/team` endpoint, rendered from Supabase.

## Approved technology stack

| Layer | Technology |
|---|---|
| Hosting | Vercel (Hobby tier) |
| Front end | React 19 with Next.js 16 (App Router), Tailwind CSS |
| Back end | TypeScript on Node.js 22, Next.js API routes |
| Database | Supabase PostgreSQL 17 |
| Authentication | Supabase Auth |
| Other | Google Gemini API, GitHub |
| IDE | Visual Studio Code |

The stack was later extended for SpatialOS: Three.js for the 3D viewer, and Unity with the Niantic Spatial SDK for the iPhone app. See the [main README](../../README.md).

## Team

| Name | Role |
|---|---|
| Daksh Kumar | Team Lead |
| Sumit Kumar | AI Master |
| Calvin Mei | Front-end Lead |
| Noah Bran | Back-end Lead |
| Tyler Duong | Scrum Master |
| Ezeren Masangcay | GitHub Master |

The report also includes each member's familiarity with every technology (1 to 5) and a four-week study plan with a leader and a support member per technology.
