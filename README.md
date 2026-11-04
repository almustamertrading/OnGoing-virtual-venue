# OnGoing Virtual Venue

A collaborative map planner for sports events and venues. Teams draw venue layouts on satellite imagery, discuss them with map-pinned comments, and inspect sites through 360° photos. Every change syncs live to everyone viewing the same venue.

## What it does

- **Events, venues and teams.** Create an event, add venues by searching for them, and invite teammates as owners, editors or viewers.
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

- `events`, `event_members` (roles: owner, editor, viewer), `venues`, `layers`, `features`, `comments`, `panoramas`, `profiles`.
- `features.geometry` stores GeoJSON. `features.geom` is a PostGIS column generated from it, with a spatial index for queries such as areas and distances.
- Row level security is on for every table. Members can read their events. Owners and editors can change plans. Anyone in the event can comment. Only owners manage members.
- 360° photos sit in the private `panoramas` storage bucket under `<event_id>/`, with the same member rules. The app shows them through signed links that expire.

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
