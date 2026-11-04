# OnGoing Virtual Venue

OnGoingEvent's project platform. Each project has one workspace for its client, scope, deliverables, tasks, milestones, team, venues and activity history. Teams plan venues on satellite maps, discuss them with map-pinned comments, and inspect sites through 360° photos. Changes sync live to everyone viewing the same project.

## What it does

- **Projects and clients.** Each project gets a code such as `2027-014`, a client, type, status, dates, location and budget in SAR.
- **Project workspace.** Overview, Scope, Tasks, Team, Venues and Activity tabs. Tasks sit on a four-column board with assignees, due dates, priorities and milestones. Overdue items show in red.
- **Company and roles.** Anyone who signs up with an `ongoingevent.com` or `futuresceneksa.com` email joins the company automatically; the first becomes its admin. Company domains live in the `organization_domains` table. Company admins see every project. Inside a project, people are owners, editors or viewers, each with a stated responsibility. Viewers, such as outside partners, can still update tasks assigned to them.
- **Activity log.** Database triggers record every change to a project, so the history cannot be skipped by any screen.
- **Map planner.** Draw areas, rectangles, circles, lines and points on satellite or street maps. Shapes live in colour-coded layers such as security, crowd flow, hospitality, broadcast and logistics. Each shape has a name, notes, and a live area or length measurement.
- **Live co-editing.** Shapes, layers, comments and photos sync instantly between users. Avatars show who is online, and the shape panel shows who else is looking at the same shape.
- **Comments.** Pin a comment anywhere on the map, reply in threads, and resolve or reopen them. Viewers can comment too.
- **360° visits.** Upload equirectangular photos pinned to where they were taken, then look around in an in-browser 360° viewer.

## Stack

| Part | Choice |
| --- | --- |
| App | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Backend | Supabase: Postgres with PostGIS, Auth, Realtime, Storage |
| Map | MapLibre GL JS 6, Esri World Imagery and CARTO base maps |
| Drawing | Terra Draw with its MapLibre adapter |
| 360° viewer | Photo Sphere Viewer |

## Run it locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000 and create an account.

`.env.example` already points at the project's Supabase instance. The publishable key is designed to be public. Never put the secret or `service_role` key in a `NEXT_PUBLIC_` variable.

## Deploy

1. Import this repository into Vercel, or any host that runs Next.js.
2. Add the two variables from `.env.example` in the host's environment settings.
3. In the Supabase dashboard, open Authentication, then URL Configuration. Set **Site URL** to the deployed address, and add `https://<your-domain>/auth/callback` under **Redirect URLs**. Without this, confirmation emails link to localhost.

`npm install` copies MapLibre's worker file into `public/vendor/`, and `npm run build` repeats the copy. MapLibre 6 needs that file to draw map tiles.

## Database

Migrations live in `supabase/migrations/` and have been applied to the Supabase project.

- `organizations`, `organization_domains`, `organization_members` (admin, manager, staff), `clients`, `projects`, `project_members` (owner, editor, viewer, plus a responsibility), `scope_items`, `milestones`, `tasks`, `activity`, `profiles`.
- Planner tables: `venues`, `layers`, `features`, `comments`, `panoramas`.
- `features.geometry` stores GeoJSON. `features.geom` is a PostGIS column generated from it, with a spatial index for queries such as areas and distances.
- Row level security is on for every table. Project members read their projects; owners and editors change them; anyone on the project can comment; only owners manage the team. Company admins have owner rights on every company project.
- 360° photos sit in the private `panoramas` storage bucket under `<project_id>/`, with the same member rules. The app shows them through signed links that expire.

## Known limits

- **Email.** Supabase's built-in email sender allows only a few emails per hour. Set up custom SMTP under Authentication, then Emails, before inviting a real team.
- **Invites.** Teammates must create an account before an owner can add them by email.
- **Base maps.** Esri and CARTO tiles are fine for development and light use. Check their terms, or switch to a paid tile provider, before commercial launch.
- **Conflicts.** When two people edit the same shape at the same moment, the last save wins.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
